import { SolumjsMiddleware, SolumjsRequest, SolumjsResponse, SolumjsNext } from "@solumjs/http";

type RedisClientV4 = {
    get(key: string): Promise<string | null>;
    set(key: string, value: string, options?: { EX?: number; PX?: number; NX?: boolean }): Promise<void>;
    incr(key: string): Promise<number>;
    pttl(key: string): Promise<number>;
    del(key: string): Promise<void>;
    expire(key: string, seconds: number): Promise<void>;
};

export interface RedisRateLimitOptions {
    redis: RedisClientV4;
    windowMs: number;
    max: number;
    keyPrefix?: string;
    trustProxy?: boolean;
}

export function createRedisRateLimit(options: RedisRateLimitOptions): SolumjsMiddleware {
    const prefix = options.keyPrefix ?? "solumjs:ratelimit:";

    return async (req: SolumjsRequest, res: SolumjsResponse, next: SolumjsNext) => {
        const ip = options.trustProxy
            ? (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ?? req.raw.socket?.remoteAddress ?? "unknown"
            : req.raw.socket?.remoteAddress ?? "unknown";

        const key = `${prefix}${ip}`;
        const now = Date.now();
        const windowSeconds = Math.ceil(options.windowMs / 1000);

        try {
            const current = await options.redis.incr(key);
            if (current === 1) {
                await options.redis.expire(key, windowSeconds);
            }

            const ttlMs = await options.redis.pttl(key);
            const resetSeconds = Math.ceil(ttlMs / 1000);
            const remaining = Math.max(options.max - current, 0);

            res.raw.setHeader("ratelimit-policy", `${options.max};w=${windowSeconds}`);
            res.raw.setHeader("ratelimit-limit", String(options.max));
            res.raw.setHeader("ratelimit-remaining", String(remaining));
            res.raw.setHeader("ratelimit-reset", String(resetSeconds));

            if (current > options.max) {
                res.raw.setHeader("retry-after", String(resetSeconds));
                res.status(429).json({
                    status: "error",
                    message: "Too many requests, please try again later.",
                });
                return;
            }

            next();
        } catch (err) {
            res.status(503).json({
                status: "error",
                message: "Service temporarily unavailable",
            });
            return;
        }
    };
}
