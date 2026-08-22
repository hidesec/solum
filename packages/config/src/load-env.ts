import fs from "fs";
import path from "path";
import { ConfigPort } from "@solumjs/core";
import { createYamlConfig, loadProfileConfig } from "./profile-config";

export function createEnvConfig(source: Record<string, unknown>): ConfigPort {
    const read = (key: string): string | undefined => {
        const value = source[key];
        return value === undefined || value === null || value === "" ? undefined : String(value);
    };

    return {
        get: read,
        getNumber: (key) => {
            const value = read(key);
            if (value === undefined) return undefined;
            const parsed = Number(value);
            return Number.isNaN(parsed) ? undefined : parsed;
        },
        getBoolean: (key) => {
            const value = read(key);
            if (value === undefined) return undefined;
            return ["1", "true", "yes", "on"].includes(value.toLowerCase());
        },
    };
}

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

export function loadApplicationConfig(configDir?: string, configFileName?: string): Record<string, string> {
    return createYamlConfig(configDir, configFileName);
}
