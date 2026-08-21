import fs from "fs";
import path from "path";

function parseEnvFile(content: string): Record<string, string> {
    const parsed: Record<string, string> = {};

    for (const rawLine of content.split(/\r?\n/)) {
        const line = rawLine.trim();
        if (line === "" || line.startsWith("#")) continue;

        const eqIndex = line.indexOf("=");
        if (eqIndex === -1) continue;

        const key = line.slice(0, eqIndex).trim();
        let value = line.slice(eqIndex + 1).trim();

        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
        }

        if (key !== "") {
            parsed[key] = value;
        }
    }

    return parsed;
}

export function loadEnv(fileName: string = ".env"): void {
    const filePath = path.join(process.cwd(), fileName);

    if (!fs.existsSync(filePath)) return;

    const parsed = parseEnvFile(fs.readFileSync(filePath, "utf8"));

    for (const [key, value] of Object.entries(parsed)) {
        if (!(key in process.env)) {
            process.env[key] = value;
        }
    }
}
