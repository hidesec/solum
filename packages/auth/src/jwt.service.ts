import { randomUUID } from "crypto";
import { getFrameworkConfig } from "@solumjs/core";
import { Bean } from "@solumjs/decorators";
import { signJwt, verifyJwt } from "./crypto.util";
import { IJwtService, JwtPayload, TokenClaims, TokenType } from "./jwt.service.interface";

const ACCESS_TOKEN_TTL = 3600;
export const REFRESH_TOKEN_TTL = 7 * 24 * 3600;

function getJwtSecret(): string {
    const secret = getFrameworkConfig().get("JWT_SECRET");
    if (!secret) {
        throw new Error("JWT_SECRET is not configured. Provide it via setFrameworkConfig() or the JWT_SECRET environment variable.");
    }
    return secret;
}

@Bean("IJwtService")
export class JwtService implements IJwtService {
    signAccessToken(claims: TokenClaims, expiresInSeconds: number = ACCESS_TOKEN_TTL): string {
        return this.sign(claims, "access", expiresInSeconds);
    }

    signRefreshToken(claims: TokenClaims, expiresInSeconds: number = REFRESH_TOKEN_TTL): string {
        return this.sign(claims, "refresh", expiresInSeconds);
    }

    verify(token: string): JwtPayload | null {
        return verifyJwt<JwtPayload>(token, getJwtSecret());
    }

    private sign(claims: TokenClaims, type: TokenType, expiresInSeconds: number): string {
        const jti = type === "refresh" ? randomUUID() : undefined;
        return signJwt({ ...claims, type, ...(jti ? { jti } : {}) }, getJwtSecret(), expiresInSeconds);
    }
}
