import { randomUUID } from "crypto";
import { getFrameworkLogger } from "@solumjs/core";
import { SolumjsLogger, SolumjsMiddleware } from "@solumjs/http";

export function requestLogger(): SolumjsMiddleware {
    return (req, res, next) => {
        const reqId = randomUUID();
        const start = process.hrtime.bigint();
        const clientIp = req.raw.socket?.remoteAddress ?? req.headers["x-forwarded-for"] ?? req.headers["x-real-ip"] ?? "unknown";

        const requestLogger: SolumjsLogger = getFrameworkLogger().child({ reqId });
        (req as { log: SolumjsLogger }).log = requestLogger;

        res.raw.on("finish", () => {
            const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
            const statusCode = res.raw.statusCode;
            const meta = {
                method: req.method,
                path: req.path,
                statusCode,
                responseTime: Math.round(durationMs * 1000) / 1000,
                reqId,
                clientIp,
            };

            if (statusCode >= 500) {
                requestLogger.error(meta, "request failed");
            } else if (statusCode >= 400) {
                requestLogger.warn(meta, "request completed");
            } else {
                requestLogger.info(meta, "request completed");
            }
        });

        next();
    };
}
