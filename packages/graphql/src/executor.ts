export interface GraphQLRequest {
    query?: string;
    operationName?: string;
    variables?: Record<string, any>;
}

export interface GraphQLResponse {
    data?: any;
    errors?: GraphQLError[];
}

export interface GraphQLError {
    message: string;
    locations?: Array<{ line: number; column: number }>;
    path?: Array<string | number>;
    extensions?: Record<string, any>;
}

export interface GraphQLExecutionResult {
    data?: any;
    errors?: GraphQLError[];
}

const MAX_QUERY_DEPTH = 10;

function getFieldDepth(field: ParsedField): number {
    if (!field.selections || field.selections.length === 0) return 0;
    return 1 + Math.max(...field.selections.map(getFieldDepth));
}

function checkQueryFields(fields: ParsedField[]): void {
    for (const field of fields) {
        const depth = getFieldDepth(field);
        if (depth > MAX_QUERY_DEPTH) {
            throw new Error("Query depth exceeds maximum allowed depth");
        }
        if (field.selections) {
            checkQueryFields(field.selections);
        }
    }
}

interface ParsedField {
    name: string;
    alias?: string;
    args?: Record<string, any>;
    selections?: ParsedField[];
}

function parseFields(query: string): ParsedField[] {
    const fields: ParsedField[] = [];
    const lines = query.split("\n").map((l) => l.trim()).filter(Boolean);

    let depthStack: ParsedField[][] = [fields];
    let currentList = fields;
    let cumulativeDepth = 0;

    for (const line of lines) {
        let cleanLine = line.replace(/[()]/g, "").trim();
        if (!cleanLine || cleanLine.startsWith("query") || cleanLine.startsWith("mutation") || cleanLine.startsWith("subscription")) continue;

        let opens = 0;
        let closes = 0;
        for (const ch of cleanLine) {
            if (ch === "{") opens++;
            if (ch === "}") closes++;
        }

        if (cleanLine.endsWith("{")) {
            cleanLine = cleanLine.replace(/{/, "").trim();
        }

        if (cleanLine.startsWith("}") || cleanLine === "}") {
            cumulativeDepth = Math.max(0, cumulativeDepth - closes);
            for (let i = 0; i < closes; i++) {
                depthStack.pop();
                currentList = depthStack[depthStack.length - 1] || fields;
            }
            continue;
        }

        const nameMatch = cleanLine.match(/^(\w+)/);
        if (!nameMatch) continue;

        const name = nameMatch[1];
        const field: ParsedField = { name };

        const aliasMatch = cleanLine.match(/^(\w+)\s*:\s*(\w+)/);
        if (aliasMatch) {
            field.name = aliasMatch[2];
            field.alias = aliasMatch[1];
        }

        const argsMatch = cleanLine.match(/\(([^)]+)\)/);
        if (argsMatch) {
            const argsStr = argsMatch[1];
            const args: Record<string, any> = {};
            const argPairs = argsStr.split(",");
            for (const pair of argPairs) {
                const [key, ...valueParts] = pair.split(":");
                if (key && valueParts.length > 0) {
                    const value = valueParts.join(":").trim();
                    if (value.startsWith('"') && value.endsWith('"')) {
                        args[key.trim()] = value.slice(1, -1);
                    } else if (!isNaN(Number(value))) {
                        args[key.trim()] = Number(value);
                    } else if (value === "true") {
                        args[key.trim()] = true;
                    } else if (value === "false") {
                        args[key.trim()] = false;
                    } else if (value === "null") {
                        args[key.trim()] = null;
                    } else {
                        args[key.trim()] = value;
                    }
                }
            }
            field.args = args;
        }

        currentList.push(field);

        if (opens > 0) {
            field.selections = [];
            depthStack.push(field.selections);
            currentList = field.selections;
            cumulativeDepth += opens;
        }
    }

    return fields;
}

function parseQuery(query: string): { type: string; name?: string; fields: ParsedField[] } {
    const trimmed = query.trim();
    let type = "query";
    let name: string | undefined;

    if (trimmed.startsWith("mutation")) {
        type = "mutation";
    } else if (trimmed.startsWith("subscription")) {
        type = "subscription";
    }

    const operationMatch = trimmed.match(/^(query|mutation|subscription)\s+(\w+)/);
    if (operationMatch) {
        name = operationMatch[2];
    }

    const fields = parseFields(trimmed);
    return { type, name, fields };
}

function executeField(
    field: ParsedField,
    resolver: any,
    parent: any,
    context: any
): any {
    const fieldResolver = resolver[field.name];
    if (!fieldResolver) {
        return null;
    }

    const args = field.args || {};
    const result = fieldResolver(parent, args, context);

    if (field.selections && field.selections.length > 0) {
        if (Array.isArray(result)) {
            return result.map((item) => {
                const resolved: Record<string, any> = {};
                for (const selection of field.selections!) {
                    resolved[selection.alias || selection.name] = executeField(selection, item || {}, item, context);
                }
                return resolved;
            });
        }

        const resolved: Record<string, any> = {};
        for (const selection of field.selections) {
            resolved[selection.alias || selection.name] = executeField(selection, result || {}, result, context);
        }
        return resolved;
    }

    return result;
}

export function executeGraphQL(
    query: string,
    resolvers: Record<string, any>,
    variables: Record<string, any> = {},
    context: any = {}
): GraphQLExecutionResult {
    try {
        const parsed = parseQuery(query);

        checkQueryFields(parsed.fields);

        const rootResolver = resolvers[parsed.type] || {};

        const data: Record<string, any> = {};
        for (const field of parsed.fields) {
            const alias = field.alias || field.name;
            data[alias] = executeField(field, rootResolver, null, { ...context, variables });
        }

        return { data };
    } catch (error) {
        return {
            errors: [
                {
                    message: "Query processing failed",
                    extensions: { code: "EXECUTION_ERROR" },
                },
            ],
        };
    }
}
