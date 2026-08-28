import os from "os";
import { HttpAdapter, SolumjsMiddleware, SolumjsRequest, SolumjsResponse } from "@solumjs/http";
import { getDatabaseDriver } from "@solumjs/orm";
import { getFrameworkLogger, container } from "@solumjs/core";

export interface ActuatorOptions {
    basePath?: string;
    healthchecks?: HealthCheck[];
    info?: Record<string, unknown>;
    customEndpoints?: CustomEndpoint[];
    authGuard?: (req: any, res: any) => boolean;
    prometheus?: PrometheusOptions;
}

export interface PrometheusOptions {
    enabled?: boolean;
    prefix?: string;
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

const startTime = Date.now();

class PrometheusMetrics {
    private counters = new Map<string, number>();
    private gauges = new Map<string, number>();
    private histograms = new Map<string, number[]>();
    private prefix: string;

    constructor(prefix: string = "") {
        this.prefix = prefix;
    }

    incCounter(name: string, value: number = 1): void {
        this.counters.set(name, (this.counters.get(name) ?? 0) + value);
    }

    setGauge(name: string, value: number): void {
        this.gauges.set(name, value);
    }

    observeHistogram(name: string, value: number): void {
        const existing = this.histograms.get(name) ?? [];
        existing.push(value);
        this.histograms.set(name, existing);
    }

    format(): string {
        const lines: string[] = [];

        for (const [name, value] of this.counters) {
            lines.push(`# HELP ${this.prefix}${name} Counter`);
            lines.push(`# TYPE ${this.prefix}${name} counter`);
            lines.push(`${this.prefix}${name} ${value}`);
        }

        for (const [name, value] of this.gauges) {
            lines.push(`# HELP ${this.prefix}${name} Gauge`);
            lines.push(`# TYPE ${this.prefix}${name} gauge`);
            lines.push(`${this.prefix}${name} ${value}`);
        }

        for (const [name, values] of this.histograms) {
            lines.push(`# HELP ${this.prefix}${name} Histogram`);
            lines.push(`# TYPE ${this.prefix}${name} histogram`);
            const sorted = [...values].sort((a, b) => a - b);
            const buckets = [1, 5, 10, 25, 50, 100, 250, 500, 1000];
            for (const bucket of buckets) {
                const count = sorted.filter((v) => v <= bucket).length;
                lines.push(`${this.prefix}${name}_bucket{le="${bucket}"} ${count}`);
            }
            lines.push(`${this.prefix}${name}_bucket{le="+Inf"} ${sorted.length}`);
            const sum = sorted.reduce((a, b) => a + b, 0);
            lines.push(`${this.prefix}${name}_sum ${sum}`);
            lines.push(`${this.prefix}${name}_count ${sorted.length}`);
        }

        return lines.join("\n") + "\n";
    }
}

export const prometheusMetrics = new PrometheusMetrics("solum_");

function defaultDatabaseHealthCheck(): Promise<HealthStatus> {
    try {
        const driver = getDatabaseDriver();
        return driver.query("SELECT 1").then(() => ({ status: "UP" as const, details: { client: driver.clientName } }));
    } catch (err) {
        return Promise.resolve({
            status: "DOWN",
            details: { error: err instanceof Error ? err.message : String(err) },
        });
    }
}

function memoryHealthCheck(): HealthStatus {
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
        getFrameworkLogger().warn("Actuator endpoints have no authGuard configured. Sensitive endpoints (env, beans, mappings) are restricted to localhost only. Set options.authGuard to protect all endpoints.");
    }

    const isLocalhost = (req: any): boolean => {
        const addr = req.socket?.remoteAddress ?? "";
        return addr === "127.0.0.1" || addr === "::1" || addr === "::ffff:127.0.0.1";
    };

    const protectedHandler = (handler: (req: any, res: any) => void | Promise<void>) => (req: any, res: any) => {
        if (authGuard && !authGuard(req, res)) {
            res.status(401).json({ status: "error", message: "Unauthorized" });
            return;
        }
        if (!authGuard && !isLocalhost(req)) {
            res.status(403).json({ status: "error", message: "Forbidden: actuator endpoints require authGuard or localhost access" });
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
            checks.memory = memoryHealthCheck();

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
                version: process.env.SOLUM_APP_VERSION || "0.2.0",
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
            const ALLOWED_KEYS = /^(NODE_ENV|SOLUM_PROFILE|SOLUM_APP_NAME|SOLUM_APP_VERSION|PORT|HOST|LOG_LEVEL|TZ)$/i;
            const env: Record<string, string> = {};
            for (const [key, value] of Object.entries(process.env)) {
                if (value !== undefined && ALLOWED_KEYS.test(key)) {
                    env[key] = value;
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

    if (options.prometheus?.enabled !== false) {
        const promPrefix = options.prometheus?.prefix ?? "solum_";
        prometheusMetrics["prefix"] = promPrefix;

        adapter.registerRoute(basePath, {
            method: "get",
            path: "/prometheus",
            handler: protectedHandler((_req: any, res: any) => {
                prometheusMetrics.setGauge("uptime_seconds", Math.floor((Date.now() - startTime) / 1000));
                prometheusMetrics.setGauge("memory_heap_used_bytes", process.memoryUsage().heapUsed);
                prometheusMetrics.setGauge("memory_rss_bytes", process.memoryUsage().rss);

                res.raw.setHeader("content-type", "text/plain; version=0.0.4; charset=utf-8");
                res.raw.end(prometheusMetrics.format());
            }),
        });
    }

    const allCustomEndpoints = options.customEndpoints || [];
    for (const endpoint of allCustomEndpoints) {
        adapter.registerRoute(basePath, {
            method: endpoint.method || "get",
            path: endpoint.path,
            handler: protectedHandler(endpoint.handler),
        });
    }
}

export function createHttpMetricsMiddleware(): SolumjsMiddleware {
    const requestCount = new Map<string, number>();
    const responseTimes = new Map<string, number[]>();
    const statusCounts = new Map<string, number>();

    function normalizePath(path: string): string {
        return path
            .replace(/\/\d+/g, "/:id")
            .replace(/\/[a-f0-9-]{36}/g, "/:uuid")
            .replace(/\/[a-f0-9]{24}/g, "/:objectId");
    }

    return (req: SolumjsRequest, res: SolumjsResponse, next: () => void) => {
        const start = Date.now();
        const normalizedPath = normalizePath(req.path);
        const method = req.method.toUpperCase();

        const originalEnd = res.raw.end.bind(res.raw);
        res.raw.end = function (...args: any[]) {
            const duration = Date.now() - start;
            const statusCode = res.raw.statusCode;
            const key = `${method} ${normalizedPath}`;
            const statusKey = `${statusCode}`;

            requestCount.set(key, (requestCount.get(key) ?? 0) + 1);

            const times = responseTimes.get(key) ?? [];
            times.push(duration);
            if (times.length > 1000) times.shift();
            responseTimes.set(key, times);

            statusCounts.set(statusKey, (statusCounts.get(statusKey) ?? 0) + 1);

            prometheusMetrics.incCounter("http_requests_total");
            prometheusMetrics.observeHistogram("http_request_duration_ms", duration);
            prometheusMetrics.setGauge("http_requests_active", requestCount.size);

            return originalEnd(...args);
        };

        next();
    };
}
