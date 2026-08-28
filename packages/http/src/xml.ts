const SAFE_TAG_REGEX = /^[a-zA-Z_][a-zA-Z0-9_.-]*$/;

function escapeXml(str: string): string {
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");
}

function validateTagName(name: string): string {
    const safe = name.replace(/[^a-zA-Z0-9_.-]/g, "_");
    if (!SAFE_TAG_REGEX.test(safe)) {
        return "item";
    }
    return safe;
}

function toXmlValue(value: unknown, indent: number = 0): string {
    const pad = "  ".repeat(indent);

    if (value === null || value === undefined) {
        return `${pad}<null/>`;
    }

    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
        return escapeXml(String(value));
    }

    if (Array.isArray(value)) {
        const items = value.map((item) => {
            const inner = toXmlValue(item, indent + 1);
            return `${pad}  <item>\n${inner}\n${pad}  </item>`;
        }).join("\n");
        return `${pad}<list>\n${items}\n${pad}</list>`;
    }

    const entries = Object.entries(value as Record<string, unknown>).map(([key, val]) => {
        const safeKey = key.replace(/[^a-zA-Z0-9_]/g, "_");
        if (typeof val === "object" && val !== null && !Array.isArray(val)) {
            const inner = toXmlValue(val, indent + 1);
            return `${pad}  <${safeKey}>\n${inner}\n${pad}  </${safeKey}>`;
        }
        const inner = toXmlValue(val, indent + 1);
        return `${pad}  <${safeKey}>${inner}</${safeKey}>`;
    }).join("\n");

    return entries;
}

export function objectToXml(obj: unknown, rootTag: string = "response"): string {
    const safeTag = validateTagName(rootTag);

    if (Array.isArray(obj)) {
        const items = obj.map((item) => {
            const inner = toXmlValue(item, 2);
            return `    <item>\n${inner}\n    </item>`;
        }).join("\n");
        return `<?xml version="1.0" encoding="UTF-8"?>\n<${safeTag}>\n  <list>\n${items}\n  </list>\n</${safeTag}>`;
    }

    const inner = toXmlValue(obj, 1);
    return `<?xml version="1.0" encoding="UTF-8"?>\n<${safeTag}>\n${inner}\n</${safeTag}>`;
}
