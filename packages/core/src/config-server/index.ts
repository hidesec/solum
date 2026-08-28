import http from "http";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { getFrameworkLogger } from "../framework-logger";

export interface ConfigServerOptions {
    port?: number;
    host?: string;
    configDir?: string;
    gitUri?: string;
    refreshIntervalMs?: number;
    authToken?: string;
}

export interface ConfigRepository {
    getProperties(application: string, profile: string, label: string): Promise<Record<string, unknown>>;
    getPropertiesByUri(uri: string): Promise<Record<string, unknown>>;
}

const SAFE_NAME_PATTERN = /^[a-zA-Z0-9._-]+$/;

function sanitizeName(name: string): string | null {
    const clean = name.replace(/[^a-zA-Z0-9._-]/g, "");
    if (clean !== name || clean.includes("..") || clean.length > 128) return null;
    return clean;
}

export class FileSystemConfigRepository implements ConfigRepository {
    private configDir: string;

    constructor(configDir: string) {
        this.configDir = path.resolve(configDir);
    }

    async getProperties(application: string, profile: string, _label: string): Promise<Record<string, unknown>> {
        const safeApp = sanitizeName(application);
        const safeProfile = sanitizeName(profile);
        if (!safeApp || !safeProfile) {
            throw new Error("Invalid application or profile name");
        }

        const results: Record<string, unknown> = {};

        const baseFile = path.join(this.configDir, `${safeApp}.json`);
        if (fs.existsSync(baseFile) && baseFile.startsWith(this.configDir)) {
            const content = fs.readFileSync(baseFile, "utf8");
            Object.assign(results, JSON.parse(content));
        }

        if (safeProfile) {
            const profileFile = path.join(this.configDir, `${safeApp}-${safeProfile}.json`);
            if (fs.existsSync(profileFile) && profileFile.startsWith(this.configDir)) {
                const content = fs.readFileSync(profileFile, "utf8");
                Object.assign(results, JSON.parse(content));
            }
        }

        return results;
    }

    async getPropertiesByUri(uri: string): Promise<Record<string, unknown>> {
        const safeUri = sanitizeName(uri.replace(/\//g, ""));
        if (!safeUri || safeUri !== uri.replace(/\//g, "")) {
            throw new Error("Access denied: invalid URI characters");
        }
        const resolved = path.resolve(this.configDir, uri);
        try {
            const realConfigDir = fs.realpathSync(this.configDir);
            const realResolved = fs.realpathSync(resolved);
            if (!realResolved.startsWith(realConfigDir + path.sep) && realResolved !== realConfigDir) {
                throw new Error("Access denied: path outside config directory");
            }
        } catch (err) {
            if ((err as NodeJS.ErrnoException).code === "ENOENT") {
                return {};
            }
            throw err;
        }
        if (fs.existsSync(resolved)) {
            const content = fs.readFileSync(resolved, "utf8");
            return JSON.parse(content);
        }
        return {};
    }
}

export class InMemoryConfigRepository implements ConfigRepository {
    private configs = new Map<string, Record<string, unknown>>();

    set(application: string, profile: string, properties: Record<string, unknown>): void {
        this.configs.set(`${application}/${profile}`, properties);
    }

    async getProperties(application: string, profile: string, _label: string): Promise<Record<string, unknown>> {
        return this.configs.get(`${application}/${profile}`) || {};
    }

    async getPropertiesByUri(_uri: string): Promise<Record<string, unknown>> {
        return {};
    }
}

export class ConfigServer {
    private server: http.Server | null = null;
    private repository: ConfigRepository;
    private cache = new Map<string, { properties: Record<string, unknown>; timestamp: number }>();
    private refreshTimer: NodeJS.Timeout | null = null;

    constructor(repository: ConfigRepository, private options: ConfigServerOptions = {}) {
        this.repository = repository;
    }

    start(): Promise<void> {
        return new Promise((resolve) => {
            const port = this.options.port || 8888;
            const host = this.options.host || "127.0.0.1";
            const authToken = this.options.authToken;

            if (!authToken) {
                getFrameworkLogger().warn("[ConfigServer] No authToken configured. Server is only accessible from localhost.");
            }

            this.server = http.createServer((req, res) => {
                const remoteAddr = req.socket.remoteAddress ?? "";
                const isLocalhost = remoteAddr === "127.0.0.1" || remoteAddr === "::1" || remoteAddr === "::ffff:127.0.0.1";

                if (!isLocalhost) {
                    if (!authToken) {
                        res.writeHead(403, { "Content-Type": "application/json" });
                        res.end(JSON.stringify({ error: "Forbidden: non-localhost access requires authToken" }));
                        return;
                    }
                    const authHeader = req.headers.authorization;
                    const provided = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : "";
                    if (!provided || provided.length !== authToken.length || !crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(authToken))) {
                        res.writeHead(401, { "Content-Type": "application/json" });
                        res.end(JSON.stringify({ error: "Unauthorized" }));
                        return;
                    }
                }

                const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

                if (req.method === "GET" && url.pathname.startsWith("/")) {
                    const parts = url.pathname.slice(1).split("/");
                    const application = parts[0] || "application";
                    const profile = parts[1] || "default";
                    const label = parts[2] || "main";

                    this.getProperties(application, profile, label)
                        .then((properties) => {
                            res.writeHead(200, { "Content-Type": "application/json" });
                            res.end(JSON.stringify(properties));
                        })
                        .catch(() => {
                            res.writeHead(500);
                            res.end(JSON.stringify({ error: "Failed to load configuration" }));
                        });
                    return;
                }

                if (req.method === "POST" && url.pathname === "/refresh") {
                    this.cache.clear();
                    res.writeHead(200, { "Content-Type": "application/json" });
                    res.end(JSON.stringify({ status: "refreshed" }));
                    return;
                }

                res.writeHead(404);
                res.end(JSON.stringify({ error: "Not found" }));
            });

            this.server.listen(port, host, () => {
                getFrameworkLogger().info({ port, host }, "Config server started");
                resolve();
            });

            if (this.options.refreshIntervalMs) {
                this.refreshTimer = setInterval(() => {
                    this.cache.clear();
                }, this.options.refreshIntervalMs);
            }
        });
    }

    stop(): Promise<void> {
        return new Promise((resolve) => {
            if (this.refreshTimer) {
                clearInterval(this.refreshTimer);
                this.refreshTimer = null;
            }
            if (this.server) {
                this.server.close(() => resolve());
            } else {
                resolve();
            }
        });
    }

    async getProperties(application: string, profile: string, label: string): Promise<Record<string, unknown>> {
        const cacheKey = `${application}/${profile}/${label}`;
        const cached = this.cache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < 60000) {
            return cached.properties;
        }

        const properties = await this.repository.getProperties(application, profile, label);
        this.cache.set(cacheKey, { properties, timestamp: Date.now() });
        return properties;
    }
}

export interface ConfigClientOptions {
    serverUrl: string;
    application: string;
    profile?: string;
    label?: string;
    timeout?: number;
}

export class ConfigClient {
    private properties: Record<string, unknown> = {};

    constructor(private options: ConfigClientOptions) {}

    async fetchProperties(): Promise<Record<string, unknown>> {
        const profile = this.options.profile || "default";
        const label = this.options.label || "main";
        const url = `${this.options.serverUrl}/${this.options.application}/${profile}/${label}`;

        return new Promise((resolve, reject) => {
            const parsed = new URL(url);
            const req = http.request(
                {
                    hostname: parsed.hostname,
                    port: parsed.port,
                    path: parsed.pathname + parsed.search,
                    method: "GET",
                    timeout: this.options.timeout || 5000,
                },
                (res) => {
                    const chunks: Buffer[] = [];
                    res.on("data", (chunk) => chunks.push(chunk));
                    res.on("end", () => {
                        try {
                            const body = Buffer.concat(chunks).toString("utf8");
                            this.properties = JSON.parse(body);
                            resolve(this.properties);
                        } catch {
                            resolve({});
                        }
                    });
                }
            );
            req.on("error", reject);
            req.on("timeout", () => {
                req.destroy();
                reject(new Error("Config fetch timeout"));
            });
            req.end();
        });
    }

    getProperty<T = unknown>(key: string): T | undefined {
        return this.properties[key] as T;
    }

    getAll(): Record<string, unknown> {
        return { ...this.properties };
    }
}

export function createConfigServer(repository: ConfigRepository, options?: ConfigServerOptions): ConfigServer {
    return new ConfigServer(repository, options);
}

export function createConfigClient(options: ConfigClientOptions): ConfigClient {
    return new ConfigClient(options);
}
