import os from "os";
import { HttpAdapter } from "@solumjs/http";
import { getDatabaseDriver } from "@solumjs/orm";
import { getFrameworkLogger, container } from "@solumjs/core";

export interface ActuatorOptions {
    basePath?: string;
    healthchecks?: HealthCheck[];
    info?: Record<string, unknown>;
    customEndpoints?: CustomEndpoint[];
    authGuard?: (req: any, res: any) => boolean;
}

export interface HealthCheck {
    name: string;
    check: () => Promise<HealthStatus>;
}

export interface HealthStatus {
    status: "UP" | "DOWN" | "OUT_OF_SERVICE";
    details?: Record<string, unknown>;
}

export interface CustomEndpoint {
    path: string;
    method?: "get" | "post";
    handler: (req: any, res: any) => void | Promise<void>;
}

const customEndpoints: CustomEndpoint[] = [];

export function registerCustomEndpoint(endpoint: CustomEndpoint): void {
    customEndpoints.push(endpoint);
}

const startTime = Date.now();

async function defaultDatabaseHealthCheck(): Promise<HealthStatus> {
    try {
        const driver = getDatabaseDriver();
        await driver.query("SELECT 1");
        return { status: "UP", details: { client: driver.clientName } };
    } catch (err) {
        return {
            status: "DOWN",
            details: { error: err instanceof Error ? err.message : String(err) },
        };
    }
}

async function memoryHealthCheck(): Promise<HealthStatus> {
    const mem = process.memoryUsage();
    const heapUsedMB = Math.round(mem.heapUsed / 1024 / 1024);
    const heapTotalMB = Math.round(mem.heapTotal / 1024 / 1024);
    const rssMB = Math.round(mem.rss / 1024 / 1024);

    const status = heapUsedMB / heapTotalMB > 0.9 ? "DOWN" : "UP";

    return {
        status,
        details: {
            heapUsed: `${heapUsedMB}MB`,
            heapTotal: `${heapTotalMB}MB`,
            rss: `${rssMB}MB`,
        },
    };
}

function formatUptime(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h ${minutes % 60}m`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
}

export function mountActuator(adapter: HttpAdapter, options: ActuatorOptions = {}): void {
    const basePath = options.basePath ?? "/actuator";
    const healthchecks: HealthCheck[] = options.healthchecks ?? [];
    const authGuard = options.authGuard;

    if (!authGuard) {
        getFrameworkLogger().warn("Actuator endpoints have no authGuard configured. All actuator endpoints are publicly accessible. Set options.authGuard to protect them.");
    }

    const protectedHandler = (handler: (req: any, res: any) => void | Promise<void>) => (req: any, res: any) => {
        if (authGuard && !authGuard(req, res)) {
            res.status(401).json({ status: "error", message: "Unauthorized" });
            return;
        }
        return handler(req, res);
    };

    const jsonHandler = (data: unknown) => protectedHandler((_req: any, res: any) => {
        res.status(200).json(data);
    });

    adapter.registerRoute(basePath, {
        method: "get",
        path: "/health",
        handler: protectedHandler(async (_req: any, res: any) => {
            const checks: Record<string, HealthStatus> = {};

            checks.database = await defaultDatabaseHealthCheck();
            checks.memory = await memoryHealthCheck();

            for (const hc of healthchecks) {
                try {
                    checks[hc.name] = await hc.check();
                } catch (err) {
                    checks[hc.name] = {
                        status: "DOWN",
                        details: { error: err instanceof Error ? err.message : String(err) },
                    };
                }
            }

            const overallStatus = Object.values(checks).every((c) => c.status === "UP") ? "UP" : "DOWN";

            res.status(overallStatus === "UP" ? 200 : 503).json({
                status: overallStatus,
                checks,
            });
        }),
    });

    adapter.registerRoute(basePath, {
        method: "get",
        path: "/metrics",
        handler: jsonHandler({
            uptime: formatUptime(Date.now() - startTime),
            uptimeMs: Date.now() - startTime,
            system: {
                nodeVersion: process.version,
                platform: process.platform,
                arch: process.arch,
                cpus: os.cpus().length,
                memory: {
                    total: `${Math.round(os.totalmem() / 1024 / 1024)}MB`,
                    free: `${Math.round(os.freemem() / 1024 / 1024)}MB`,
                    used: `${Math.round((os.totalmem() - os.freemem()) / 1024 / 1024)}MB`,
                },
            },
        }),
    });

    adapter.registerRoute(basePath, {
        method: "get",
        path: "/info",
        handler: jsonHandler({
            app: {
                name: process.env.SOLUM_APP_NAME || "SolumJS Application",
                version: process.env.SOLUM_APP_VERSION || "0.1.0",
                environment: process.env.SOLUM_PROFILE || process.env.NODE_ENV || "development",
            },
            build: {
                nodeVersion: process.version,
                timestamp: new Date().toISOString(),
            },
            ...(options.info || {}),
        }),
    });

    adapter.registerRoute(basePath, {
        method: "get",
        path: "/beans",
        handler: protectedHandler((_req: any, res: any) => {
            const beans = container.listBeans();
            res.status(200).json({
                context: {
                    beans: beans.map((b) => ({
                        name: b.token,
                        scope: b.scope,
                    })),
                    count: beans.length,
                },
            });
        }),
    });

    adapter.registerRoute(basePath, {
        method: "get",
        path: "/mappings",
        handler: protectedHandler((_req: any, res: any) => {
            const routes: Array<{ method: string; path: string }> = [];
            const adapterAny = adapter as any;
            if (adapterAny.routes && Array.isArray(adapterAny.routes)) {
                for (const route of adapterAny.routes) {
                    if (route.method && route.path) {
                        routes.push({
                            method: route.method.toUpperCase(),
                            path: route.fullPath ?? route.path,
                        });
                    }
                }
            }
            res.status(200).json({
                mappings: routes,
                count: routes.length,
            });
        }),
    });

    adapter.registerRoute(basePath, {
        method: "get",
        path: "/env",
        handler: protectedHandler((_req: any, res: any) => {
            const sensitiveKeys = /password|secret|token|key|credential|auth/i;
            const env: Record<string, string> = {};
            for (const [key, value] of Object.entries(process.env)) {
                if (value !== undefined) {
                    env[key] = sensitiveKeys.test(key) ? "******" : value;
                }
            }
            res.status(200).json({
                activeProfiles: process.env.SOLUM_PROFILE || process.env.NODE_ENV || "development",
                propertySources: [{ name: "systemProperties", properties: env }],
            });
        }),
    });

    adapter.registerRoute(basePath, {
        method: "get",
        path: "/loggers",
        handler: protectedHandler((_req: any, res: any) => {
            res.status(200).json({
                levels: ["error", "warn", "info", "debug", "trace"],
                loggers: {
                    root: { effectiveLevel: process.env.LOG_LEVEL || "info" },
                },
            });
        }),
    });

    const allCustomEndpoints = [...customEndpoints, ...(options.customEndpoints || [])];
    for (const endpoint of allCustomEndpoints) {
        adapter.registerRoute(basePath, {
            method: endpoint.method || "get",
            path: endpoint.path,
            handler: endpoint.handler,
        });
    }
}
