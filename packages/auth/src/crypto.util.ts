import crypto from "crypto";

const ALLOWED_JWT_ALGORITHMS = new Set(["HS256"]);

export interface JwtVerifyOptions {
    issuer?: string;
    audience?: string;
    clockToleranceSeconds?: number;
}

export function signJwt(payload: Record<string, unknown>, secret: string, expiresInSeconds: number): string {
    const header = { alg: "HS256", typ: "JWT", iss: payload["iss"] as string | undefined };
    const iat = Math.floor(Date.now() / 1000);
    const body = { ...payload, iat, exp: iat + expiresInSeconds };
    const encodedHeader = Buffer.from(JSON.stringify(header)).toString("base64url");
    const encodedPayload = Buffer.from(JSON.stringify(body)).toString("base64url");
    const data = `${encodedHeader}.${encodedPayload}`;
    const signature = crypto.createHmac("sha256", secret).update(data).digest("base64url");
    return `${data}.${signature}`;
}

const MAX_JWT_LENGTH = 8192;

export function verifyJwt<T extends object>(token: string, secret: string, options?: JwtVerifyOptions): T | null {
    if (token.length > MAX_JWT_LENGTH) return null;
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const [encodedHeader, encodedPayload, signature] = parts;

    const headerRaw = JSON.parse(Buffer.from(encodedHeader, "base64url").toString("utf8"));
    if (!headerRaw.alg || !ALLOWED_JWT_ALGORITHMS.has(headerRaw.alg)) {
        return null;
    }

    const expected = crypto.createHmac("sha256", secret).update(`${encodedHeader}.${encodedPayload}`).digest();
    let provided: Buffer;
    try {
        provided = Buffer.from(signature, "base64url");
    } catch {
        return null;
    }

    if (provided.length !== expected.length || !crypto.timingSafeEqual(provided, expected)) {
        return null;
    }

    try {
        const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as T & { exp?: number; iss?: string; aud?: string; nbf?: number };
        if (typeof payload.exp === "number" && payload.exp <= Math.floor(Date.now() / 1000)) {
            return null;
        }
        const clockTolerance = options?.clockToleranceSeconds ?? 0;
        if (typeof payload.nbf === "number" && payload.nbf > Math.floor(Date.now() / 1000) + clockTolerance) {
            return null;
        }
        if (options?.issuer && payload.iss !== options.issuer) {
            return null;
        }
        if (options?.audience && payload.aud !== options.audience) {
            return null;
        }
        return payload;
    } catch {
        return null;
    }
}

const SCRYPT_KEY_LENGTH = 64;
const SCRYPT_COST = 16384;
const SCRYPT_BLOCK_SIZE = 8;
const SCRYPT_PARALLELIZATION = 1;

export function hashPassword(password: string): string {
    const salt = crypto.randomBytes(16);
    const derived = crypto.scryptSync(password, salt, SCRYPT_KEY_LENGTH, {
        N: SCRYPT_COST,
        r: SCRYPT_BLOCK_SIZE,
        p: SCRYPT_PARALLELIZATION,
    });
    return `scrypt:${salt.toString("hex")}:${derived.toString("hex")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
    const [scheme, saltHex, hashHex] = stored.split(":");
    if (scheme !== "scrypt" || !saltHex || !hashHex) return false;

    const expected = Buffer.from(hashHex, "hex");
    const derived = crypto.scryptSync(password, Buffer.from(saltHex, "hex"), expected.length);
    return crypto.timingSafeEqual(derived, expected);
}
