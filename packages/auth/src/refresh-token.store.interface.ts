export interface IRefreshTokenStore {
    markUsed(jti: string, expiresAt: number): void;
    markUsedIfAbsent(jti: string, expiresAt: number): boolean;
    isUsed(jti: string): boolean;
}
