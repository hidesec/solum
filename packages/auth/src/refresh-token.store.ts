import { Bean } from "@solumjs/core";
import { IRefreshTokenStore } from "./refresh-token.store.interface";

@Bean("IRefreshTokenStore")
export class RefreshTokenStore implements IRefreshTokenStore {
    private readonly used = new Map<string, { expiresAt: number }>();

    markUsed(jti: string, expiresAt: number): void {
        this.prune();
        this.used.set(jti, { expiresAt });
    }

    isUsed(jti: string): boolean {
        this.prune();
        return this.used.has(jti);
    }

    private prune(): void {
        const now = Date.now();
        for (const [jti, entry] of this.used.entries()) {
            if (entry.expiresAt <= now) {
                this.used.delete(jti);
            }
        }
    }
}
