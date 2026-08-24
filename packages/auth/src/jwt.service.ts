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

const revokedJtis = new Set<string>();

function cleanupRevokedTokens(): void {
    revokedJtis.clear();
}
setInterval(cleanupRevokedTokens, 60 * 60 * 1000);

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
            revokedJtis.add(payload.jti);
        }
    }

    isRevoked(jti: string): boolean {
        return revokedJtis.has(jti);
    }

    private sign(claims: TokenClaims, type: TokenType, expiresInSeconds: number): string {
        const jti = randomUUID();
        return signJwt({ ...claims, type, jti }, getJwtSecret(), expiresInSeconds);
    }
}
