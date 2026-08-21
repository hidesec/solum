import { loadEnv } from "@solumjs/config";

loadEnv();

type EnvValue = string | number;

interface FieldSpec {
    required?: boolean;
    default?: EnvValue | ((env: Record<string, EnvValue>) => EnvValue);
    choices?: string[];
    isPort?: boolean;
    isNumber?: boolean;
    requiredWhen?: (env: Record<string, EnvValue>) => boolean;
}

const DB_CLIENTS = ["postgres", "mysql", "mssql", "oracle", "sqlite"];

const DEFAULT_PORTS: Record<string, number> = {
    postgres: 5432,
    mysql: 3306,
    mssql: 1433,
    oracle: 1521,
    sqlite: 0,
};

const SCHEMA: Record<string, FieldSpec> = {
    NODE_ENV: { required: true, choices: ["development", "production", "test"] },
    PORT: { default: 3000, isPort: true },
    JWT_SECRET: { required: true },
    RATE_LIMIT_MAX: { default: 100, isNumber: true },
    DB_CLIENT: { default: "postgres", choices: DB_CLIENTS },
    DB_FILE: { default: "./data/app.db" },
    DB_HOST: { default: "localhost", requiredWhen: (e) => e.DB_CLIENT !== "sqlite" },
    DB_PORT: { default: (e) => DEFAULT_PORTS[e.DB_CLIENT as string] ?? 5432, isPort: true },
    DB_NAME: { requiredWhen: (e) => e.DB_CLIENT !== "sqlite" },
    DB_USER: { requiredWhen: (e) => e.DB_CLIENT !== "sqlite" },
    DB_PASSWORD: { requiredWhen: (e) => e.DB_CLIENT !== "sqlite" },
    MONGO_URL: {},
    REDIS_URL: {},
    CORS_ORIGIN: {},
};

function validate(spec: FieldSpec, key: string, raw: string | undefined, current: Record<string, EnvValue>): EnvValue {
    if (raw === undefined || raw === "") {
        if (typeof spec.default === "function") return spec.default(current);
        if (spec.default !== undefined) return spec.default;
        if (spec.required || spec.requiredWhen?.(current)) {
            throw new Error(`Missing required environment variable "${key}"`);
        }
        return "";
    }

    if (spec.choices && !spec.choices.includes(raw)) {
        throw new Error(`Environment variable "${key}" must be one of: ${spec.choices.join(", ")}`);
    }

    if (spec.isPort) {
        const port = Number(raw);
        if (!Number.isInteger(port) || port < 0 || port > 65535) {
            throw new Error(`Environment variable "${key}" must be a valid port number`);
        }
        return port;
    }

    if (spec.isNumber) {
        const num = Number(raw);
        if (!Number.isFinite(num)) {
            throw new Error(`Environment variable "${key}" must be a number`);
        }
        return num;
    }

    return raw;
}

function buildEnv(): Record<string, EnvValue> {
    const errors: string[] = [];
    const result: Record<string, EnvValue> = {};

    for (const [key, spec] of Object.entries(SCHEMA)) {
        try {
            result[key] = validate(spec, key, process.env[key], result);
        } catch (err) {
            errors.push((err as Error).message);
        }
    }

    if (errors.length > 0) {
        throw new Error(`Invalid environment configuration:\n${errors.map((e) => ` - ${e}`).join("\n")}`);
    }

    return result;
}

export const env = buildEnv() as {
    NODE_ENV: "development" | "production" | "test";
    PORT: number;
    JWT_SECRET: string;
    RATE_LIMIT_MAX: number;
    DB_CLIENT: "postgres" | "mysql" | "mssql" | "oracle" | "sqlite";
    DB_FILE: string;
    DB_HOST: string;
    DB_PORT: number;
    DB_NAME: string;
    DB_USER: string;
    DB_PASSWORD: string;
    MONGO_URL: string;
    REDIS_URL: string;
};
