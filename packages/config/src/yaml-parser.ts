import fs from "fs";
import path from "path";

export interface YamlDocument {
    [key: string]: unknown;
}

function parseScalar(value: string): unknown {
    const trimmed = value.trim();
    if (trimmed === "" || trimmed === "null") return null;
    if (trimmed === "true") return true;
    if (trimmed === "false") return false;
    if (/^-?\d+(\.\d+)?$/.test(trimmed)) return Number(trimmed);
    if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
        return trimmed.slice(1, -1);
    }
    return trimmed;
}

function expandPlaceholders(value: string, source: Record<string, string>): string {
    return value.replace(/\$\{([^:$}]+)(?::([^}]*))?\}/g, (_match, key, defaultVal) => {
        const envVal = source[key];
        if (envVal !== undefined && envVal !== "") return envVal;
        if (defaultVal !== undefined) return defaultVal;
        return _match;
    });
}

export function parseYaml(content: string): YamlDocument {
    const lines = content.split(/\r?\n/);
    const root: YamlDocument = {};
    const stack: { indent: number; obj: YamlDocument }[] = [{ indent: -1, obj: root }];

    for (const rawLine of lines) {
        if (rawLine.trim() === "" || rawLine.trim().startsWith("#")) continue;

        const indent = rawLine.search(/\S/);
        const line = rawLine.trim();

        while (stack.length > 1 && stack[stack.length - 1].indent >= indent) {
            stack.pop();
        }

        const current = stack[stack.length - 1].obj;

        if (line.endsWith(":")) {
            const key = line.slice(0, -1).trim();
            const child: YamlDocument = {};
            current[key] = child;
            stack.push({ indent, obj: child });
        } else {
            const colonIndex = line.indexOf(":");
            if (colonIndex > 0) {
                const key = line.slice(0, colonIndex).trim();
                const valueStr = line.slice(colonIndex + 1).trim();

                if (valueStr === "" || valueStr === "|") {
                    const child: YamlDocument = {};
                    current[key] = child;
                    stack.push({ indent, obj: child });
                } else if (valueStr.startsWith("[")) {
                    current[key] = parseInlineArray(valueStr);
                } else {
                    current[key] = parseScalar(valueStr);
                }
            }
        }
    }

    return root;
}

function parseInlineArray(str: string): unknown[] {
    const inner = str.slice(1, -1).trim();
    if (inner === "") return [];
    return inner.split(",").map((item) => parseScalar(item.trim()));
}

export function loadYamlFile(filePath: string): YamlDocument | null {
    if (!fs.existsSync(filePath)) return null;
    const content = fs.readFileSync(filePath, "utf8");
    return parseYaml(content);
}

export function mergeYaml(base: YamlDocument, override: YamlDocument): YamlDocument {
    const result: YamlDocument = { ...base };

    for (const [key, value] of Object.entries(override)) {
        if (value !== null && typeof value === "object" && !Array.isArray(value) && typeof result[key] === "object" && result[key] !== null) {
            result[key] = mergeYaml(result[key] as YamlDocument, value as YamlDocument);
        } else {
            result[key] = value;
        }
    }

    return result;
}

export function flattenYaml(doc: YamlDocument, prefix: string = ""): Record<string, string> {
    const result: Record<string, string> = {};

    for (const [key, value] of Object.entries(doc)) {
        const fullKey = prefix ? `${prefix}.${key}` : key;

        if (value !== null && typeof value === "object" && !Array.isArray(value)) {
            Object.assign(result, flattenYaml(value as YamlDocument, fullKey));
        } else if (Array.isArray(value)) {
            result[fullKey] = JSON.stringify(value);
        } else if (value !== null && value !== undefined) {
            result[fullKey] = String(value);
        }
    }

    return result;
}

export function resolvePlaceholders(doc: YamlDocument, env: Record<string, string>): YamlDocument {
    const result: YamlDocument = {};

    for (const [key, value] of Object.entries(doc)) {
        if (typeof value === "string") {
            result[key] = expandPlaceholders(value, env);
        } else if (value !== null && typeof value === "object" && !Array.isArray(value)) {
            result[key] = resolvePlaceholders(value as YamlDocument, env);
        } else {
            result[key] = value;
        }
    }

    return result;
}
