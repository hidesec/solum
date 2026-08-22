import os from "os";
import { HttpAdapter } from "@solumjs/http";
import { getDatabaseDriver } from "@solumjs/orm";

export interface ActuatorOptions {
    basePath?: string;
    healthchecks?: HealthCheck[];
    info?: Record<string, unknown>;
}

export interface HealthCheck {
    name: string;
    check: () => Promise<HealthStatus>;
}

export interface HealthStatus {
    status: "UP" | "DOWN" | "OUT_OF_SERVICE";
    details?: Record<string, unknown>;
}

const startTime = Date.now();
let requestCount = 0;
let errorCount = 0;
const responseTimes: number[] = [];

function getAverageResponseTime(): number {
    if (responseTimes.length === 0) return 0;
    return responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
}

function getP99ResponseTime(): number {
    if (responseTimes.length === 0) return 0;
    const sorted = [...responseTimes].sort((a, b) => a - b);
    const p99Index = Math.floor(sorted.length * 0.99);
    return sorted[p99Index] || 0;
}

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

    const jsonHandler = (data: unknown) => (req: any, res: any) => {
        res.status(200).json(data);
    };

    adapter.registerRoute(basePath, {
        method: "get",
        path: "/health",
        handler: async (_req: any, res: any) => {
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
        },
    });

    adapter.registerRoute(basePath, {
        method: "get",
        path: "/metrics",
        handler: jsonHandler({
            uptime: formatUptime(Date.now() - startTime),
            uptimeMs: Date.now() - startTime,
            requests: {
                total: requestCount,
                errors: errorCount,
                successRate: requestCount > 0 ? ((requestCount - errorCount) / requestCount * 100).toFixed(2) + "%" : "N/A",
            },
            responseTime: {
                avg: Math.round(getAverageResponseTime() * 100) / 100,
                p99: Math.round(getP99ResponseTime() * 100) / 100,
            },
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
}
