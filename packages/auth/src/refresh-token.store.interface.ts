export interface IRefreshTokenStore {
    markUsed(jti: string, expiresAt: number): void;
    isUsed(jti: string): boolean;
}
