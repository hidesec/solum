import http from "http";
import crypto from "crypto";
import { getFrameworkLogger } from "../framework-logger";

export interface ServiceInstance {
    serviceId: string;
    host: string;
    port: number;
    metadata?: Record<string, string>;
    status: "UP" | "DOWN" | "OUT_OF_SERVICE";
    registeredAt: number;
    lastHeartbeat: number;
}

export interface ServiceRegistryOptions {
    port?: number;
    host?: string;
    heartbeatIntervalMs?: number;
    instanceTtlMs?: number;
    authToken?: string;
}

const instances = new Map<string, Map<string, ServiceInstance>>();
let registryServer: http.Server | null = null;
let heartbeatTimer: NodeJS.Timeout | null = null;

export function createServiceInstance(
    serviceId: string,
    host: string,
    port: number,
    metadata?: Record<string, string>
): ServiceInstance {
    const now = Date.now();
    return {
        serviceId,
        host,
        port,
        metadata,
        status: "UP",
        registeredAt: now,
        lastHeartbeat: now,
    };
}

export function registerInstance(instance: ServiceInstance): void {
    if (!instances.has(instance.serviceId)) {
        instances.set(instance.serviceId, new Map());
    }
    instances.get(instance.serviceId)!.set(instance.host + ":" + instance.port, instance);
    getFrameworkLogger().info(
        { serviceId: instance.serviceId, host: instance.host, port: instance.port },
        "Service registered"
    );
}

export function deregisterInstance(serviceId: string, host: string, port: number): void {
    instances.get(serviceId)?.delete(host + ":" + port);
    getFrameworkLogger().info({ serviceId, host, port }, "Service deregistered");
}

export function discoverInstances(serviceId: string): ServiceInstance[] {
    const serviceInstances = instances.get(serviceId);
    if (!serviceInstances) return [];
    return Array.from(serviceInstances.values()).filter((i) => i.status === "UP");
}

export function discoverOne(serviceId: string): ServiceInstance | null {
    const all = discoverInstances(serviceId);
    if (all.length === 0) return null;
    return all[Math.floor(Math.random() * all.length)];
}

export function updateInstanceStatus(serviceId: string, host: string, port: number, status: ServiceInstance["status"]): void {
    const instance = instances.get(serviceId)?.get(host + ":" + port);
    if (instance) {
        instance.status = status;
    }
}

export function getAllInstances(): Map<string, Map<string, ServiceInstance>> {
    return instances;
}

function startHeartbeatCheck(intervalMs: number, ttlMs: number): void {
    heartbeatTimer = setInterval(() => {
        const now = Date.now();
        for (const [serviceId, serviceInstances] of instances) {
            for (const [key, instance] of serviceInstances) {
                if (now - instance.lastHeartbeat > ttlMs) {
                    instance.status = "DOWN";
                    getFrameworkLogger().warn(
                        { serviceId, host: instance.host, port: instance.port },
                        "Service instance marked DOWN (heartbeat timeout)"
                    );
                }
            }
        }
    }, intervalMs);
}

export function startRegistry(options: ServiceRegistryOptions = {}): http.Server {
    const port = options.port || 8761;
    const host = options.host || "127.0.0.1";
    const heartbeatInterval = options.heartbeatIntervalMs || 30000;
    const instanceTtl = options.instanceTtlMs || 90000;
    const authToken = options.authToken;

    if (!authToken) {
        getFrameworkLogger().warn("[Discovery] No authToken configured. Registry is only accessible from localhost.");
    }

    registryServer = http.createServer((req, res) => {
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
            if (!provided || !crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(authToken))) {
                res.writeHead(401, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ error: "Unauthorized" }));
                return;
            }
        }

        const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

        if (req.method === "POST" && url.pathname === "/register") {
            let body = "";
            req.on("data", (chunk) => (body += chunk));
            req.on("end", () => {
                try {
                    const raw = JSON.parse(body);
                    if (!raw.serviceId || !raw.host || typeof raw.port !== "number") {
                        res.writeHead(400, { "Content-Type": "application/json" });
                        res.end(JSON.stringify({ error: "Missing required fields: serviceId, host, port" }));
                        return;
                    }
                    const instance: ServiceInstance = {
                        serviceId: String(raw.serviceId).slice(0, 128),
                        host: String(raw.host).slice(0, 256),
                        port: Math.max(1, Math.min(65535, Math.floor(raw.port))),
                        metadata: raw.metadata && typeof raw.metadata === "object" ? raw.metadata : undefined,
                        status: "UP",
                        registeredAt: Date.now(),
                        lastHeartbeat: Date.now(),
                    };
                    registerInstance(instance);
                    res.writeHead(200, { "Content-Type": "application/json" });
                    res.end(JSON.stringify({ status: "OK" }));
                } catch {
                    res.writeHead(400);
                    res.end(JSON.stringify({ error: "Invalid request body" }));
                }
            });
            return;
        }

        if (req.method === "DELETE" && url.pathname === "/deregister") {
            let body = "";
            req.on("data", (chunk) => (body += chunk));
            req.on("end", () => {
                try {
                    const { serviceId, host, port } = JSON.parse(body);
                    deregisterInstance(serviceId, host, port);
                    res.writeHead(200, { "Content-Type": "application/json" });
                    res.end(JSON.stringify({ status: "OK" }));
                } catch {
                    res.writeHead(400);
                    res.end(JSON.stringify({ error: "Invalid request body" }));
                }
            });
            return;
        }

        if (req.method === "GET" && url.pathname === "/discovery") {
            const serviceId = url.searchParams.get("serviceId");
            if (serviceId) {
                const discovered = discoverInstances(serviceId);
                res.writeHead(200, { "Content-Type": "application/json" });
                res.end(JSON.stringify(discovered));
            } else {
                const all: Record<string, ServiceInstance[]> = {};
                for (const [id, map] of instances) {
                    all[id] = Array.from(map.values());
                }
                res.writeHead(200, { "Content-Type": "application/json" });
                res.end(JSON.stringify(all));
            }
            return;
        }

        if (req.method === "POST" && url.pathname === "/heartbeat") {
            let body = "";
            req.on("data", (chunk) => (body += chunk));
            req.on("end", () => {
                try {
                    const { serviceId, host, port } = JSON.parse(body);
                    const instance = instances.get(serviceId)?.get(host + ":" + port);
                    if (instance) {
                        instance.lastHeartbeat = Date.now();
                        instance.status = "UP";
                    }
                    res.writeHead(200, { "Content-Type": "application/json" });
                    res.end(JSON.stringify({ status: "OK" }));
                } catch {
                    res.writeHead(400);
                    res.end(JSON.stringify({ error: "Invalid request body" }));
                }
            });
            return;
        }

        res.writeHead(404);
        res.end(JSON.stringify({ error: "Not found" }));
    });

    registryServer.listen(port, host, () => {
        getFrameworkLogger().info({ port, host }, "Service registry started");
    });

    startHeartbeatCheck(heartbeatInterval, instanceTtl);

    return registryServer;
}

export function stopRegistry(): Promise<void> {
    return new Promise((resolve) => {
        if (heartbeatTimer) {
            clearInterval(heartbeatTimer);
            heartbeatTimer = null;
        }
        if (registryServer) {
            registryServer.close(() => {
                registryServer = null;
                resolve();
            });
        } else {
            resolve();
        }
    });
}

export class DiscoveryClient {
    private registryUrl: string;
    private heartbeatTimer: NodeJS.Timeout | null = null;

    constructor(registryUrl: string) {
        this.registryUrl = registryUrl;
    }

    async register(instance: ServiceInstance): Promise<void> {
        await this.post("/register", instance);
        getFrameworkLogger().info({ serviceId: instance.serviceId }, "Registered with registry");
    }

    async deregister(serviceId: string, host: string, port: number): Promise<void> {
        await this.post("/deregister", { serviceId, host, port });
    }

    async discover(serviceId: string): Promise<ServiceInstance[]> {
        const url = `${this.registryUrl}/discovery?serviceId=${encodeURIComponent(serviceId)}`;
        return new Promise((resolve, reject) => {
            const parsed = new URL(url);
            const req = http.request(
                { hostname: parsed.hostname, port: parsed.port, path: parsed.pathname + parsed.search, method: "GET" },
                (res) => {
                    const chunks: Buffer[] = [];
                    res.on("data", (chunk) => chunks.push(chunk));
                    res.on("end", () => {
                        try {
                            resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
                        } catch {
                            resolve([]);
                        }
                    });
                }
            );
            req.on("error", reject);
            req.end();
        });
    }

    async discoverOne(serviceId: string): Promise<ServiceInstance | null> {
        const instances = await this.discover(serviceId);
        if (instances.length === 0) return null;
        return instances[Math.floor(Math.random() * instances.length)];
    }

    startHeartbeat(instance: ServiceInstance, intervalMs: number = 30000): void {
        this.heartbeatTimer = setInterval(async () => {
            try {
                await this.post("/heartbeat", {
                    serviceId: instance.serviceId,
                    host: instance.host,
                    port: instance.port,
                });
            } catch {
                getFrameworkLogger().warn({ serviceId: instance.serviceId }, "Heartbeat failed");
            }
        }, intervalMs);
    }

    stopHeartbeat(): void {
        if (this.heartbeatTimer) {
            clearInterval(this.heartbeatTimer);
            this.heartbeatTimer = null;
        }
    }

    private async post(path: string, body: unknown): Promise<void> {
        const parsed = new URL(this.registryUrl);
        const bodyStr = JSON.stringify(body);

        return new Promise((resolve, reject) => {
            const req = http.request(
                {
                    hostname: parsed.hostname,
                    port: parsed.port,
                    path,
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Content-Length": Buffer.byteLength(bodyStr).toString(),
                    },
                },
                (res) => {
                    res.resume();
                    res.on("end", resolve);
                }
            );
            req.on("error", reject);
            req.write(bodyStr);
            req.end();
        });
    }
}
