import { randomBytes, timingSafeEqual } from "crypto";
import { SolumjsMiddleware, SolumjsRequest, SolumjsResponse, SolumjsNext } from "@solumjs/http";

export interface CsrfOptions {
    cookieName?: string;
    headerName?: string;
    secret?: string;
    ttlSeconds?: number;
    sameSite?: "strict" | "lax" | "none";
    secure?: boolean;
    ignoreMethods?: string[];
}

function sign(payload: string, secret: string): string {
    const hmac = require("crypto").createHmac("sha256", secret);
    hmac.update(payload);
    return hmac.digest("hex");
}

function verify(payload: string, signature: string, secret: string): boolean {
    const expected = sign(payload, secret);
    if (expected.length !== signature.length) return false;
    return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(signature, "hex"));
}

export function csrfProtection(options: CsrfOptions): SolumjsMiddleware {
    if (!options.secret || options.secret.length < 32) {
        throw new Error("CSRF secret is required and must be at least 32 characters. Provide options.secret.");
    }
    const cookieName = options.cookieName ?? "_csrf";
    const headerName = options.headerName ?? "x-csrf-token";
    const secret = options.secret;
    const ttl = options.ttlSeconds ?? 3600;
    const sameSite = options.sameSite ?? "lax";
    const secure = options.secure ?? false;
    const ignoreMethods = options.ignoreMethods ?? ["GET", "HEAD", "OPTIONS"];

    return (req: SolumjsRequest, res: SolumjsResponse, next: SolumjsNext) => {
        if (ignoreMethods.includes(req.method)) {
            const token = randomBytes(32).toString("hex");
            const signature = sign(token, secret);
            const cookieValue = `${token}.${signature}`;

            res.raw.setHeader("Set-Cookie", [
                `${cookieName}=${cookieValue}; Path=/; HttpOnly; SameSite=${sameSite}${secure ? "; Secure" : ""}; Max-Age=${ttl}`,
            ]);

            res.raw.setHeader("X-CSRF-Token", token);

            return next();
        }

        const cookieHeader = Array.isArray(req.headers.cookie) ? req.headers.cookie[0] : (req.headers.cookie ?? "");
        const cookies = Object.fromEntries(
            cookieHeader.split(";").map((c: string) => {
                const [key, ...val] = c.trim().split("=");
                return [key, val.join("=")];
            })
        );

        const cookieValue = cookies[cookieName];
        if (!cookieValue) {
            res.status(403).json({ status: "error", message: "CSRF token missing" });
            return;
        }

        const [token, signature] = cookieValue.split(".");
        if (!token || !signature) {
            res.status(403).json({ status: "error", message: "CSRF token malformed" });
            return;
        }

        if (!verify(token, signature, secret)) {
            res.status(403).json({ status: "error", message: "CSRF token invalid" });
            return;
        }

        const headerToken = (req.headers[headerName] as string) ?? "";
        if (headerToken !== token) {
            res.status(403).json({ status: "error", message: "CSRF token mismatch" });
            return;
        }

        next();
    };
}
