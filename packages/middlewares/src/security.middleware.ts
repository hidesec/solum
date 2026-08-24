import { getFrameworkConfig, getFrameworkLogger } from "@solumjs/core";
import { SolumjsMiddleware, SolumjsRequest, SolumjsResponse, SolumjsNext } from "@solumjs/http";

const SECURITY_HEADERS: Record<string, string> = {
    "content-security-policy":
        "default-src 'self';base-uri 'self';font-src 'self' https: data:;form-action 'self';frame-ancestors 'self';img-src 'self' https: data:;object-src 'none';script-src-attr 'none';style-src 'self' https: 'unsafe-inline';upgrade-insecure-requests",
    "cross-origin-opener-policy": "same-origin",
    "cross-origin-resource-policy": "same-origin",
    "origin-agent-cluster": "?1",
    "referrer-policy": "strict-origin-when-cross-origin",
    "strict-transport-security": "max-age=31536000; includeSubDomains",
    "x-content-type-options": "nosniff",
    "x-dns-prefetch-control": "off",
    "x-download-options": "noopen",
    "x-frame-options": "SAMEORIGIN",
    "x-permitted-cross-domain-policies": "none",
    "x-xss-protection": "0",
};

function securityHeaders(): SolumjsMiddleware {
    return (_req: SolumjsRequest, res: SolumjsResponse, next: SolumjsNext) => {
        for (const [header, value] of Object.entries(SECURITY_HEADERS)) {
            res.raw.setHeader(header, value);
        }
        next();
    };
}

interface CorsOptions {
    origin: string;
    credentials: boolean;
}

function cors(options: CorsOptions): SolumjsMiddleware {
    return (req: SolumjsRequest, res: SolumjsResponse, next: SolumjsNext) => {
        const requestOrigin = req.headers.origin;
        const allowedOrigin = options.origin;

        if (allowedOrigin === "*") {
            res.raw.setHeader("access-control-allow-origin", "*");
        } else if (requestOrigin && requestOrigin === allowedOrigin) {
            res.raw.setHeader("access-control-allow-origin", requestOrigin);
            res.raw.setHeader("access-control-allow-credentials", String(options.credentials));
        } else if (requestOrigin) {
            res.raw.setHeader("access-control-allow-origin", "null");
        } else {
            res.raw.setHeader("access-control-allow-origin", allowedOrigin);
        }

        if (req.method === "OPTIONS") {
            res.raw.setHeader("access-control-allow-methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
            res.raw.setHeader("access-control-allow-headers", "Content-Type,Authorization");
            res.raw.setHeader("access-control-max-age", "86400");
            res.status(204).end();
            return;
        }

        next();
    };
}

interface RateLimitBucket {
    count: number;
    resetAt: number;
}

interface RateLimitOptions {
    windowMs: number;
    max: number;
}

export function createRateLimit(options: RateLimitOptions): SolumjsMiddleware {
    const buckets = new Map<string, RateLimitBucket>();

    return (req: SolumjsRequest, res: SolumjsResponse, next: SolumjsNext) => {
        const ip = req.raw.socket?.remoteAddress ?? "unknown";
        const key = `${ip}:${req.path}`;
        const now = Date.now();

        let bucket = buckets.get(key);
        if (!bucket || bucket.resetAt <= now) {
            bucket = { count: 0, resetAt: now + options.windowMs };
            buckets.set(key, bucket);
        }

        bucket.count++;

        const remaining = Math.max(options.max - bucket.count, 0);
        const resetSeconds = Math.ceil((bucket.resetAt - now) / 1000);

        res.raw.setHeader("ratelimit-policy", `${options.max};w=${Math.round(options.windowMs / 1000)}`);
        res.raw.setHeader("ratelimit-limit", String(options.max));
        res.raw.setHeader("ratelimit-remaining", String(remaining));
        res.raw.setHeader("ratelimit-reset", String(resetSeconds));

        if (bucket.count > options.max) {
            res.raw.setHeader("retry-after", String(resetSeconds));
            res.status(429).json({
                status: "error",
                message: "Too many requests, please try again later.",
            });
            return;
        }

        if (buckets.size > 10_000) {
            for (const [bucketKey, value] of buckets.entries()) {
                if (value.resetAt <= now) buckets.delete(bucketKey);
            }
        }

        next();
    };
}

function rateLimit(options: RateLimitOptions): SolumjsMiddleware {
    const buckets = new Map<string, RateLimitBucket>();

    return (req: SolumjsRequest, res: SolumjsResponse, next: SolumjsNext) => {
        const ip = req.raw.socket?.remoteAddress ?? "unknown";
        const now = Date.now();

        let bucket = buckets.get(ip);
        if (!bucket || bucket.resetAt <= now) {
            bucket = { count: 0, resetAt: now + options.windowMs };
            buckets.set(ip, bucket);
        }

        bucket.count++;

        const remaining = Math.max(options.max - bucket.count, 0);
        const resetSeconds = Math.ceil((bucket.resetAt - now) / 1000);

        res.raw.setHeader("ratelimit-policy", `${options.max};w=${Math.round(options.windowMs / 1000)}`);
        res.raw.setHeader("ratelimit-limit", String(options.max));
        res.raw.setHeader("ratelimit-remaining", String(remaining));
        res.raw.setHeader("ratelimit-reset", String(resetSeconds));

        if (bucket.count > options.max) {
            res.raw.setHeader("retry-after", String(resetSeconds));
            res.status(429).json({
                status: "error",
                message: "Too many requests, please try again later.",
            });
            return;
        }

        if (buckets.size > 10_000) {
            for (const [key, value] of buckets.entries()) {
                if (value.resetAt <= now) buckets.delete(key);
            }
        }

        next();
    };
}

export function createSecurityMiddlewares(): SolumjsMiddleware[] {
    const config = getFrameworkConfig();
    const logger = getFrameworkLogger();
    const corsOrigin = config.get("CORS_ORIGIN");

    if (!corsOrigin) {
        logger.warn("[Security] CORS_ORIGIN not configured — cross-origin requests are DENIED. Set CORS_ORIGIN to allow specific origins.");
    }

    return [
        securityHeaders(),
        cors({
            origin: corsOrigin || "DENY",
            credentials: !!corsOrigin,
        }),
        rateLimit({
            windowMs: 15 * 60 * 1000,
            max: config.getNumber("RATE_LIMIT_MAX") ?? 100,
        }),
    ];
}
