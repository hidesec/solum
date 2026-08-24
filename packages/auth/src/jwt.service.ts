import { randomUUID } from "crypto";
import { getFrameworkConfig } from "@solumjs/core";
import { Bean } from "@solumjs/core";
import { signJwt, verifyJwt, JwtVerifyOptions } from "./crypto.util";
import { IJwtService, JwtPayload, TokenClaims, TokenType } from "./jwt.service.interface";

const ACCESS_TOKEN_TTL = 3600;
export const REFRESH_TOKEN_TTL = 7 * 24 * 3600;

const MIN_JWT_SECRET_LENGTH = 32;

function getJwtSecret(): string {
    const secret = getFrameworkConfig().get("JWT_SECRET");
    if (!secret) {
        throw new Error("JWT_SECRET is not configured. Provide it via setFrameworkConfig() or the JWT_SECRET environment variable.");
    }
    if (secret.length < MIN_JWT_SECRET_LENGTH) {
        throw new Error(
            `JWT_SECRET is too weak (${secret.length} chars). Minimum required: ${MIN_JWT_SECRET_LENGTH} characters.`
        );
    }
    return secret;
}

const revokedJtis = new Map<string, number>();

const REVOKED_TOKEN_TTL_MS = 60 * 60 * 1000;

function cleanupRevokedTokens(): void {
    const now = Date.now();
    for (const [jti, expiresAt] of revokedJtis) {
        if (expiresAt <= now) {
            revokedJtis.delete(jti);
        }
    }
}
setInterval(cleanupRevokedTokens, 10 * 60 * 1000);

@Bean("IJwtService")
export class JwtService implements IJwtService {
    signAccessToken(claims: TokenClaims, expiresInSeconds: number = ACCESS_TOKEN_TTL): string {
        return this.sign(claims, "access", expiresInSeconds);
    }

    signRefreshToken(claims: TokenClaims, expiresInSeconds: number = REFRESH_TOKEN_TTL): string {
        return this.sign(claims, "refresh", expiresInSeconds);
    }

    verify(token: string): JwtPayload | null {
        const options: JwtVerifyOptions = { issuer: getFrameworkConfig().get("JWT_ISSUER") };
        return verifyJwt<JwtPayload>(token, getJwtSecret(), options);
    }

    revoke(token: string): void {
        const payload = verifyJwt<JwtPayload>(token, getJwtSecret());
        if (payload?.jti) {
            const ttlMs = payload.exp ? (payload.exp * 1000 - Date.now()) : REVOKED_TOKEN_TTL_MS;
            revokedJtis.set(payload.jti, Date.now() + Math.max(ttlMs, REVOKED_TOKEN_TTL_MS));
        }
    }

    isRevoked(jti: string): boolean {
        const expiresAt = revokedJtis.get(jti);
        if (expiresAt === undefined) return false;
        if (expiresAt <= Date.now()) {
            revokedJtis.delete(jti);
            return false;
        }
        return true;
    }

    private sign(claims: TokenClaims, type: TokenType, expiresInSeconds: number): string {
        const jti = randomUUID();
        return signJwt({ ...claims, type, jti }, getJwtSecret(), expiresInSeconds);
    }
}
