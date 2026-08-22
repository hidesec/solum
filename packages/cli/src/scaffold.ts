import fs from "fs";
import path from "path";
import { toKebabCase } from "./generate";

interface ProjectFile {
    path: string;
    content: string;
}

function mkdirp(dir: string): void {
    fs.mkdirSync(dir, { recursive: true });
}

function writeFile(base: string, rel: string, content: string): void {
    const full = path.join(base, rel);
    mkdirp(path.dirname(full));
    fs.writeFileSync(full, content, "utf8");
}

export function scaffoldProject(projectName: string): void {
    const targetDir = path.join(process.cwd(), toKebabCase(projectName));

    if (fs.existsSync(targetDir)) {
        console.error(`Directory already exists: ${targetDir}`);
        process.exit(1);
    }

    fs.mkdirSync(targetDir, { recursive: true });
    console.log(`Creating SolumJS project "${toKebabCase(projectName)}"...`);

    const files = getProjectFiles(projectName);
    for (const f of files) {
        writeFile(targetDir, f.path, f.content);
    }

    console.log(`Project created at ${targetDir}`);
    console.log("");
    console.log("Next steps:");
    console.log(`  cd ${toKebabCase(projectName)}`);
    console.log("  cp .env.example .env");
    console.log("  npm install");
    console.log("  npm run dev");
}

function getProjectFiles(projectName: string): ProjectFile[] {
    const pkg = toKebabCase(projectName);
    return [
        rootPackageJson(pkg),
        tsconfigJson(),
        prodPathsJs(),
        jestConfigJs(),
        envExample(pkg),
        gitignore(),
        srcAppTs(),
        srcConfigEnvTs(),
        srcConfigLoggerTs(),
        srcConfigStartupBannerTs(),
        srcControllersHealthControllerTs(),
    ];
}

function rootPackageJson(pkg: string): ProjectFile {
    return {
        path: "package.json",
        content: JSON.stringify({
            name: pkg,
            version: "0.1.0",
            private: true,
            scripts: {
                dev: "ts-node-dev --respawn --transpile-only -r tsconfig-paths/register src/app.ts",
                build: "tsc",
                start: "node -r ./prod-paths.js dist/app.js",
                test: "jest",
                migrate: "ts-node -r tsconfig-paths/register src/database/migrate.ts up",
                "migrate:status": "ts-node -r tsconfig-paths/register src/database/migrate.ts status",
                "migrate:generate": "ts-node -r tsconfig-paths/register src/database/generate-migration.ts",
                "migrate:down": "ts-node -r tsconfig-paths/register src/database/migrate.ts down",
                "schema:sync": "ts-node -r tsconfig-paths/register src/database/sync-schema.ts validate",
                "schema:sync:update": "ts-node -r tsconfig-paths/register src/database/sync-schema.ts update",
            },
            dependencies: {
                "@solumjs/auth": "^0.1.0",
                "@solumjs/cache": "^0.1.0",
                "@solumjs/config": "^0.1.0",
                "@solumjs/core": "^0.1.0",
                "@solumjs/database": "^0.1.0",
                "@solumjs/events": "^0.1.0",
                "@solumjs/http": "^0.1.0",
                "@solumjs/middlewares": "^0.1.0",
                "@solumjs/orm": "^0.1.0",
                "@solumjs/schedule": "^0.1.0",
                "@solumjs/validation": "^0.1.0",
                "@solumjs/aop": "^0.1.0",
                pg: "^8.23.0",
            },
            devDependencies: {
                "@types/jest": "^30.0.0",
                "@types/node": "^26.2.0",
                "@types/pg": "^8.23.1",
                jest: "^30.4.2",
                "ts-jest": "^29.4.12",
                "ts-node-dev": "^2.0.0",
                "tsconfig-paths": "^4.2.0",
                typescript: "^6.0.3",
            },
        }, null, 2),
    };
}

function tsconfigJson(): ProjectFile {
    return {
        path: "tsconfig.json",
        content: JSON.stringify({
            compilerOptions: {
                target: "ES2022",
                module: "NodeNext",
                moduleResolution: "NodeNext",
                outDir: "dist",
                rootDir: "./src",
                declaration: true,
                strict: true,
                esModuleInterop: true,
                skipLibCheck: true,
                forceConsistentCasingInFileNames: true,
                resolveJsonModule: true,
                experimentalDecorators: true,
                emitDecoratorMetadata: true,
                paths: {
                    "@config/*": ["./src/config/*"],
                    "@controllers/*": ["./src/controllers/*"],
                    "@database/*": ["./src/database/*"],
                    "@dto/*": ["./src/dto/*"],
                    "@entities/*": ["./src/entities/*"],
                    "@repositories/*": ["./src/repositories/*"],
                    "@services/*": ["./src/services/*"],
                },
                types: ["node", "jest"],
            },
            include: ["src"],
        }, null, 2),
    };
}

function prodPathsJs(): ProjectFile {
    return {
        path: "prod-paths.js",
        content: [
            'const { register } = require("tsconfig-paths");',
            "",
            "register({",
            '    baseUrl: require("path").join(__dirname, "dist"),',
            "    paths: {",
            '        "@config/*": ["config/*"],',
            '        "@controllers/*": ["controllers/*"],',
            '        "@database/*": ["database/*"],',
            '        "@dto/*": ["dto/*"],',
            '        "@entities/*": ["entities/*"],',
            '        "@repositories/*": ["repositories/*"],',
            '        "@services/*": ["services/*"]',
            "    }",
            "});",
        ].join("\n"),
    };
}

function jestConfigJs(): ProjectFile {
    return {
        path: "jest.config.js",
        content: [
            'const tsconfig = require("./tsconfig.json");',
            "",
            "function buildModuleNameMapper() {",
            "    const paths = tsconfig.compilerOptions.paths || {};",
            "    const mapper = {};",
            "    for (const [alias, targets] of Object.entries(paths)) {",
            "        const pattern = `^${alias.replace(/\\*/g, '(.*)')}$`;",
            "        mapper[pattern] = targets.map((target) =>",
            "            `<rootDir>/${target.replace(/^\\.\\//, '').replace(/\\*/g, '$1')}`",
            "        );",
            "    }",
            "    return mapper;",
            "}",
            "",
            "module.exports = {",
            '    preset: "ts-jest",',
            '    testEnvironment: "node",',
            '    testMatch: ["**/__test__/**/*.test.ts", "**/__tests__/**/*.test.ts"],',
            "    transform: {",
            '        "^.+\\.ts$": ["ts-jest", {}],',
            "    },",
            '    moduleFileExtensions: ["ts", "js", "json"],',
            "    moduleNameMapper: buildModuleNameMapper(),",
            "};",
        ].join("\n"),
    };
}

function envExample(pkg: string): ProjectFile {
    return {
        path: ".env.example",
        content: [
            "# ===== Application =====",
            "NODE_ENV=development",
            "PORT=3000",
            "",
            "# ===== Security =====",
            "# Required. Use a long random string, e.g.: openssl rand -hex 32",
            "JWT_SECRET=your-secret-key-here",
            "",
            "# Max requests per 15 minutes per IP (default: 100)",
            "RATE_LIMIT_MAX=100",
            "",
            "# Allowed CORS origin (framework default: *)",
            "CORS_ORIGIN=http://localhost:3000",
            "",
            "# ===== Database (relational) =====",
            "# Options: postgres | mysql | mssql | oracle | sqlite",
            "DB_CLIENT=postgres",
            "",
            "# Required unless DB_CLIENT=sqlite",
            "DB_HOST=localhost",
            "DB_PORT=5432",
            `DB_NAME=${pkg}`,
            "DB_USER=postgres",
            "DB_PASSWORD=change-me",
            "",
            "# Only used when DB_CLIENT=sqlite",
            "# DB_FILE=./data/app.db",
            "",
            "# ===== MongoDB (optional) =====",
            "# MONGO_URL=mongodb://localhost:27017/myapp",
            "",
            "# ===== Redis (optional) =====",
            "# REDIS_URL=redis://localhost:6379",
        ].join("\n"),
    };
}

function gitignore(): ProjectFile {
    return {
        path: ".gitignore",
        content: ["node_modules/", "dist/", "logs/", ".env", "*.log", "data/"].join("\n"),
    };
}

function srcAppTs(): ProjectFile {
    return {
        path: "src/app.ts",
        content: [
            'import "@solumjs/core";',
            'import { createApplication, createEnvConfig, loadEnv } from "@solumjs/config";',
            'import { env } from "@config/env";',
            'import { logger } from "@config/logger";',
            'import { printStartupBanner } from "@config/startup-banner";',
            "",
            "loadEnv();",
            "",
            "createApplication({",
            "    logger,",
            "    config: createEnvConfig(env),",
            "    scanBaseDir: __dirname,",
            '    scanDirs: ["repositories", "services", "controllers"],',
            "    bodyLimitBytes: 10 * 1024,",
            "    onListen: printStartupBanner,",
            "});",
        ].join("\n"),
    };
}

function srcConfigEnvTs(): ProjectFile {
    return {
        path: "src/config/env.ts",
        content: [
            'import { loadEnv } from "@solumjs/config";',
            "",
            "loadEnv();",
            "",
            "type EnvValue = string | number;",
            "",
            "interface FieldSpec {",
            "    required?: boolean;",
            "    default?: EnvValue | ((env: Record<string, EnvValue>) => EnvValue);",
            "    choices?: string[];",
            "    isPort?: boolean;",
            "    isNumber?: boolean;",
            "    requiredWhen?: (env: Record<string, EnvValue>) => boolean;",
            "}",
            "",
            'const DB_CLIENTS = ["postgres", "mysql", "mssql", "oracle", "sqlite"];',
            "",
            "const DEFAULT_PORTS: Record<string, number> = {",
            "    postgres: 5432,",
            "    mysql: 3306,",
            "    mssql: 1433,",
            "    oracle: 1521,",
            "    sqlite: 0,",
            "};",
            "",
            "const SCHEMA: Record<string, FieldSpec> = {",
            '    NODE_ENV: { required: true, choices: ["development", "production", "test"] },',
            "    PORT: { default: 3000, isPort: true },",
            "    JWT_SECRET: { required: true },",
            "    RATE_LIMIT_MAX: { default: 100, isNumber: true },",
            '    DB_CLIENT: { default: "postgres", choices: DB_CLIENTS },',
            '    DB_FILE: { default: "./data/app.db" },',
            '    DB_HOST: { default: "localhost", requiredWhen: (e) => e.DB_CLIENT !== "sqlite" },',
            "    DB_PORT: { default: (e) => DEFAULT_PORTS[e.DB_CLIENT as string] ?? 5432, isPort: true },",
            '    DB_NAME: { requiredWhen: (e) => e.DB_CLIENT !== "sqlite" },',
            '    DB_USER: { requiredWhen: (e) => e.DB_CLIENT !== "sqlite" },',
            '    DB_PASSWORD: { requiredWhen: (e) => e.DB_CLIENT !== "sqlite" },',
            "    MONGO_URL: {},",
            "    REDIS_URL: {},",
            "    CORS_ORIGIN: {},",
            "};",
            "",
            "function validate(spec: FieldSpec, key: string, raw: string | undefined, current: Record<string, EnvValue>): EnvValue {",
            '    if (raw === undefined || raw === "") {',
            '        if (typeof spec.default === "function") return spec.default(current);',
            "        if (spec.default !== undefined) return spec.default;",
            "        if (spec.required || spec.requiredWhen?.(current)) {",
            '            throw new Error(`Missing required environment variable "${key}"`);',
            "        }",
            '        return "";',
            "    }",
            "",
            "    if (spec.choices && !spec.choices.includes(raw)) {",
            '        throw new Error(`Environment variable "${key}" must be one of: ${spec.choices.join(", ")}`);',
            "    }",
            "",
            "    if (spec.isPort) {",
            "        const port = Number(raw);",
            "        if (!Number.isInteger(port) || port < 0 || port > 65535) {",
            '            throw new Error(`Environment variable "${key}" must be a valid port number`);',
            "        }",
            "        return port;",
            "    }",
            "",
            "    if (spec.isNumber) {",
            "        const num = Number(raw);",
            "        if (!Number.isFinite(num)) {",
            '            throw new Error(`Environment variable "${key}" must be a number`);',
            "        }",
            "        return num;",
            "    }",
            "",
            "    return raw;",
            "}",
            "",
            "function buildEnv(): Record<string, EnvValue> {",
            "    const errors: string[] = [];",
            "    const result: Record<string, EnvValue> = {};",
            "",
            "    for (const [key, spec] of Object.entries(SCHEMA)) {",
            "        try {",
            "            result[key] = validate(spec, key, process.env[key], result);",
            "        } catch (err) {",
            "            errors.push((err as Error).message);",
            "        }",
            "    }",
            "",
            "    if (errors.length > 0) {",
            '        throw new Error(`Invalid environment configuration:\\n${errors.map((e) => ` - ${e}`).join("\\n")}`);',
            "    }",
            "",
            "    return result;",
            "}",
            "",
            "export const env = buildEnv();",
        ].join("\n"),
    };
}

function srcConfigLoggerTs(): ProjectFile {
    return {
        path: "src/config/logger.ts",
        content: [
            'import { styleText } from "util";',
            'import { env } from "./env";',
            "",
            'type Level = "debug" | "info" | "warn" | "error";',
            "",
            "const LEVEL_WEIGHT: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };",
            "",
            'const LEVEL_COLOR: Record<Level, "blue" | "green" | "yellow" | "red"> = {',
            '    debug: "blue",',
            '    info: "green",',
            '    warn: "yellow",',
            '    error: "red",',
            "};",
            "",
            "interface Sink {",
            "    write(level: Level, message: string, payload: Record<string, unknown>): void;",
            "}",
            "",
            'const PRETTY_SKIP_KEYS = new Set(["time", "level", "msg", "env", "pid"]);',
            "",
            "function formatValue(value: unknown): string {",
            '    if (typeof value === "string") return value;',
            "    if (value instanceof Error) return value.message;",
            "    try {",
            "        return JSON.stringify(value) ?? String(value);",
            "    } catch {",
            "        return String(value);",
            "    }",
            "}",
            "",
            "function formatPretty(level: Level, message: string, payload: Record<string, unknown>): string {",
            "    const time = new Date();",
            '    const hh = String(time.getHours()).padStart(2, "0");',
            '    const mm = String(time.getMinutes()).padStart(2, "0");',
            '    const ss = String(time.getSeconds()).padStart(2, "0");',
            "    const stamp = `${time.toISOString().slice(0, 10)} ${hh}:${mm}:${ss}`;",
            "",
            "    const coloredLevel = styleText(LEVEL_COLOR[level], level.toUpperCase());",
            "    let line = `[${stamp}] ${coloredLevel}:`;",
            "    if (message) line += ` ${styleText(\"cyan\", message)}`;",
            "",
            "    const extras: string[] = [];",
            "    for (const [key, value] of Object.entries(payload)) {",
            "        if (PRETTY_SKIP_KEYS.has(key)) continue;",
            '        if (key === "err" && value instanceof Error) {',
            '            extras.push(styleText("red", `${value.name}: ${value.message}`));',
            "            continue;",
            "        }",
            '        extras.push(`${styleText("magenta", key)}=${formatValue(value)}`);',
            "    }",
            "    if (extras.length > 0) {",
            "        line += ` ${styleText(\"dim\", `{${extras.join(\", \")}}`)}`;",
            "    }",
            "",
            "    for (const [key, value] of Object.entries(payload)) {",
            '        if (key === "err" && value instanceof Error && value.stack) {',
            '            line += `\\n${styleText("dim", value.stack.split("\\n").slice(1).join("\\n"))}`;',
            "        }",
            "    }",
            "",
            "    return line;",
            "}",
            "",
            "class Logger {",
            "    constructor(",
            "        private readonly minWeight: number,",
            "        private readonly bindings: Record<string, unknown>,",
            "        private readonly sinks: Sink[]",
            "    ) {}",
            "",
            "    child(bindings: Record<string, unknown>): Logger {",
            "        return new Logger(this.minWeight, { ...this.bindings, ...bindings }, this.sinks);",
            "    }",
            "",
            "    debug(arg: object | string, message?: string): void { this.write(\"debug\", arg, message); }",
            "    info(arg: object | string, message?: string): void { this.write(\"info\", arg, message); }",
            "    warn(arg: object | string, message?: string): void { this.write(\"warn\", arg, message); }",
            "    error(arg: object | string, message?: string): void { this.write(\"error\", arg, message); }",
            "",
            "    private write(level: Level, arg: object | string, message?: string): void {",
            "        if (LEVEL_WEIGHT[level] < this.minWeight) return;",
            '        const extra = typeof arg === "object" && arg !== null ? (arg as Record<string, unknown>) : {};',
            '        const text = message ?? (typeof arg === "string" ? arg : "");',
            "        const payload = { ...extra, ...this.bindings };",
            "        for (const sink of this.sinks) {",
            "            sink.write(level, text, payload);",
            "        }",
            "    }",
            "}",
            "",
            'const isProduction = env.NODE_ENV === "production";',
            "const minWeight = isProduction ? LEVEL_WEIGHT.info : LEVEL_WEIGHT.debug;",
            "const baseBindings = { env: env.NODE_ENV, pid: process.pid };",
            "",
            "const sinks: Sink[] = [",
            "    { write: (_level, _message, _payload) => {} },",
            "];",
            "",
            "sinks[0] = {",
            "    write(level, message, payload) {",
            "        console.log(formatPretty(level, message, payload));",
            "    },",
            "};",
            "",
            "export const logger = new Logger(minWeight, baseBindings, sinks);",
        ].join("\n"),
    };
}

function srcConfigStartupBannerTs(): ProjectFile {
    return {
        path: "src/config/startup-banner.ts",
        content: [
            'import { styleText } from "util";',
            'import { env } from "./env";',
            "",
            "export function printStartupBanner(port: number): void {",
            "    const banner = `",
            "${styleText(\"cyan\", \"╔══════════════════════════════════════════════╗\")}",
            "${styleText(\"green\", \"         Server started successfully\")}",
            "${styleText(\"dim\", \"  Environment\")} : ${styleText(\"yellow\", \"${env.NODE_ENV}\")}",
            "${styleText(\"dim\", \"  Port\")}        : ${styleText(\"yellow\", \"${port}\")}",
            "${styleText(\"dim\", \"  URL\")}         : ${styleText(\"blue\", \"http://localhost:${port}\")}",
            "${styleText(\"dim\", \"  Health\")}      : ${styleText(\"blue\", \"http://localhost:${port}/health\")}",
            "${styleText(\"dim\", \"  PID\")}         : ${process.pid}",
            "${styleText(\"dim\", \"  Node\")}        : ${process.version}",
            "${styleText(\"cyan\", \"╚══════════════════════════════════════════════╝\")}",
            "`;",
            "",
            "    console.log(banner);",
            "}",
        ].join("\n"),
    };
}

function srcControllersHealthControllerTs(): ProjectFile {
    return {
        path: "src/controllers/health.controller.ts",
        content: [
            'import { RestController, Get } from "@solumjs/http";',
            "",
            '@RestController("")',
            "export class HealthController {",
            "",
            "    @Get(\"/health\")",
            "    async health() {",
            "        return {",
            '            status: "UP",',
            '            timestamp: new Date().toISOString(),',
            "            uptime: process.uptime(),",
            "        };",
            "    }",
            "}",
        ].join("\n"),
    };
}
