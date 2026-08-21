export type TokenType = "access" | "refresh";

export interface JwtPayload {
    sub: string;
    email: string;
    role: string;
    type: TokenType;
    jti?: string;
    iat?: number;
    exp?: number;
}

export interface TokenClaims {
    sub: string;
    email: string;
    role: string;
}

export interface IJwtService {
    signAccessToken(claims: TokenClaims, expiresInSeconds?: number): string;
    signRefreshToken(claims: TokenClaims, expiresInSeconds?: number): string;
    verify(token: string): JwtPayload | null;
}
