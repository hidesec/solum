import "@solumjs/core";
import { HttpAdapter, getParamType, getParamsMetadata, getRegisteredControllers, getRoutesMetadata, ParamSource } from "@solumjs/http";
import { ValidationRule, getValidationRules } from "@solumjs/validation";

export interface DocsOptions {
    enabled?: boolean;
    specPath?: string;
    docsPath?: string;
    title?: string;
    version?: string;
    description?: string;
}

type SchemaObject = Record<string, unknown>;

const SCALAR_TYPES = [String, Number, Boolean];
const BUILTIN_OBJECTS = [Object, Array, Date, Promise, Function];

function isDtoClass(type: unknown): type is Function {
    return (
        typeof type === "function" &&
        !SCALAR_TYPES.includes(type as never) &&
        !BUILTIN_OBJECTS.includes(type as never)
    );
}

function mapDesignType(designType: unknown): SchemaObject {
    if (designType === String) return { type: "string" };
    if (designType === Number) return { type: "number" };
    if (designType === Boolean) return { type: "boolean" };
    if (designType === Date) return { type: "string", format: "date-time" };
    if (designType === Array) return { type: "array", items: {} };
    if (isDtoClass(designType)) return { $ref: `#/components/schemas/${designType.name}` };
    return { type: "object", additionalProperties: true };
}

function applyRuleConstraints(schema: SchemaObject, rules: ValidationRule[]): void {
    for (const rule of rules) {
        const params = rule.params ?? {};
        switch (rule.name) {
            case "minLength":
                schema.minLength = params.value;
                break;
            case "maxLength":
                schema.maxLength = params.value;
                break;
            case "size":
                if (schema.type === "array") {
                    schema.minItems = params.min;
                    schema.maxItems = params.max;
                } else {
                    schema.minLength = params.min;
                    schema.maxLength = params.max;
                }
                break;
            case "min":
                schema.minimum = params.value;
                break;
            case "max":
                schema.maximum = params.value;
                break;
            case "pattern":
                schema.pattern = params.pattern;
                break;
            case "isIn":
                schema.enum = params.values;
                break;
            case "isEmail":
                schema.format = "email";
                break;
            case "isUuid":
                schema.format = "uuid";
                break;
            case "isInt":
                schema.type = "integer";
                break;
        }
    }
}

export function buildDtoSchema(dtoClass: Function): SchemaObject {
    const rules = getValidationRules(dtoClass);
    const properties: Record<string, SchemaObject> = {};
    const required: string[] = [];

    for (const [property, ruleList] of rules.entries()) {
        const designType = Reflect.getMetadata("design:type", dtoClass.prototype, property);
        const schema: SchemaObject = mapDesignType(designType);
        applyRuleConstraints(schema, ruleList);
        properties[property] = schema;
        if (!ruleList.some((rule) => rule.name === "isOptional")) {
            required.push(property);
        }
    }

    const result: SchemaObject = { type: "object", properties };
    if (required.length > 0) result.required = [...required].sort();
    return result;
}

function scalarSchema(designType: unknown): SchemaObject {
    if (designType === Number) return { type: "number" };
    if (designType === Boolean) return { type: "boolean" };
    return { type: "string" };
}

function toOpenApiPath(patternPath: string): string {
    const normalized = `/${patternPath.split("/").filter(Boolean).join("/")}`;
    if (normalized === "/") return "/";
    return normalized.replace(/:([A-Za-z0-9_]+)/g, "{$1}").replace(/\/$/, "");
}

export function buildOpenApiSpec(info: DocsOptions = {}): Record<string, unknown> {
    const paths: Record<string, Record<string, unknown>> = {};
    const schemas: Record<string, SchemaObject> = {};

    for (const registration of getRegisteredControllers()) {
        const controllerTarget = registration.target;
        const tagName = controllerTarget.name;

        for (const route of getRoutesMetadata(controllerTarget)) {
            const patternPath =
                toOpenApiPath(`${registration.prefix}/${route.path}`.replace(/\/{2,}/g, "/")) || "/";
            const pathParamNames = [...patternPath.matchAll(/\{([A-Za-z0-9_]+)\}/g)].map((m) => m[1]);

            paths[patternPath] ??= {};

            const operation: Record<string, unknown> = {
                operationId: `${tagName}_${route.handlerName}`,
                tags: [tagName],
                responses: {
                    "200": { description: "Successful response" },
                },
            };

            const parameters: SchemaObject[] = [];
            for (const name of pathParamNames) {
                parameters.push({
                    name,
                    in: "path",
                    required: true,
                    schema: { type: "string" },
                });
            }

            for (const meta of getParamsMetadata(controllerTarget, route.handlerName)) {
                const paramType = getParamType(controllerTarget, route.handlerName, meta.index);

                if (meta.source === ParamSource.PARAM && meta.name && !pathParamNames.includes(meta.name)) {
                    parameters.push({
                        name: meta.name,
                        in: "path",
                        required: true,
                        schema: scalarSchema(paramType),
                    });
                    continue;
                }

                if (meta.source === ParamSource.QUERY && meta.name) {
                    parameters.push({
                        name: meta.name,
                        in: "query",
                        required: false,
                        schema: scalarSchema(paramType),
                    });
                    continue;
                }

                if (meta.source === ParamSource.QUERY && isDtoClass(paramType)) {
                    const dtoSchema = buildDtoSchema(paramType);
                    const props = (dtoSchema.properties ?? {}) as Record<string, SchemaObject>;
                    const requiredProps = new Set((dtoSchema.required as string[] | undefined) ?? []);
                    for (const [prop, propSchema] of Object.entries(props)) {
                        parameters.push({
                            name: prop,
                            in: "query",
                            required: requiredProps.has(prop),
                            schema: propSchema,
                        });
                    }
                    continue;
                }

                if (meta.source === ParamSource.HEADER && meta.name) {
                    parameters.push({
                        name: meta.name,
                        in: "header",
                        required: false,
                        schema: scalarSchema(paramType),
                    });
                    continue;
                }

                if (meta.source === ParamSource.BODY && meta.validate && isDtoClass(paramType)) {
                    schemas[paramType.name] ??= buildDtoSchema(paramType);
                    operation.requestBody = {
                        required: true,
                        content: {
                            "application/json": {
                                schema: { $ref: `#/components/schemas/${paramType.name}` },
                            },
                        },
                    };
                }
            }

            if (parameters.length > 0) operation.parameters = parameters;
            paths[patternPath][route.method.toLowerCase()] = operation;
        }
    }

    const spec: Record<string, unknown> = {
        openapi: "3.0.3",
        info: {
            title: info.title ?? "SolumJS API",
            version: info.version ?? "1.0.0",
            ...(info.description ? { description: info.description } : {}),
        },
        paths,
    };

    if (Object.keys(schemas).length > 0) {
        spec.components = { schemas };
    }

    return spec;
}

export function mountOpenApi(adapter: HttpAdapter, options: DocsOptions = {}): void {
    const specPath = options.specPath ?? "/openapi.json";
    const docsPath = options.docsPath ?? "/docs";

    adapter.registerRoute("/", {
        method: "get",
        path: specPath,
        handler: (_req, res) => {
            res.status(200).json(buildOpenApiSpec(options));
        },
    });

    adapter.registerRoute("/", {
        method: "get",
        path: docsPath,
        handler: (_req, res) => {
            res.status(200);
            res.raw.setHeader("Content-Type", "text/html; charset=utf-8");
            res.raw.end(renderSwaggerHtml(specPath, options.title ?? "SolumJS API"));
        },
    });
}

function renderSwaggerHtml(specUrl: string, title: string): string {
    const safeTitle = title.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#x27;" }[c] ?? c));
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${safeTitle}</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" integrity="sha384-Q8k0JRmG3CMQ4wjY01pHEoXbkRJaDEO6z7M7nNYb0hHBnFGhIouEAKBa7wFJM" crossorigin="anonymous" />
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js" integrity="sha384-placeholder" crossorigin="anonymous"></script>
  <script>
    SwaggerUIBundle({ url: ${JSON.stringify(specUrl)}, dom_id: "#swagger-ui" });
  </script>
</body>
</html>`;
}
