import { getFrameworkConfig } from "@solumjs/core";

import { Around, JoinPoint } from "@solumjs/aop";

export interface CacheStore {
    readonly name: string;
    get<T>(key: string): Promise<T | undefined>;
    set(key: string, value: unknown, ttlSeconds: number): Promise<void>;
    evict(prefix: string): Promise<void>;
    sweep(): Promise<number>;
    clear(): Promise<void>;
}

interface MemoryEntry {
    value: unknown;
    expiresAt: number;
}

export class InMemoryCacheStore implements CacheStore {
    readonly name = "in-memory";
    private readonly entries = new Map<string, MemoryEntry>();

    async get<T>(key: string): Promise<T | undefined> {
        const entry = this.entries.get(key);
        if (!entry) return undefined;

        if (entry.expiresAt <= Date.now()) {
            this.entries.delete(key);
            return undefined;
        }

        return entry.value as T;
    }

    async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
        this.entries.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
    }

    async evict(prefix: string): Promise<void> {
        for (const key of this.entries.keys()) {
            if (key === prefix || key.startsWith(`${prefix}:`)) {
                this.entries.delete(key);
            }
        }
    }

    async sweep(): Promise<number> {
        const now = Date.now();
        let removed = 0;
        for (const [key, entry] of this.entries.entries()) {
            if (entry.expiresAt <= now) {
                this.entries.delete(key);
                removed++;
            }
        }
        return removed;
    }

    async clear(): Promise<void> {
        this.entries.clear();
    }
}

export class CacheManager {
    private store: CacheStore = new InMemoryCacheStore();

    useStore(store: CacheStore): void {
        this.store = store;
    }

    get storeName(): string {
        return this.store.name;
    }

    get<T>(key: string): Promise<T | undefined> {
        return this.store.get<T>(key);
    }

    set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
        return this.store.set(key, value, ttlSeconds);
    }

    evict(prefix: string): Promise<void> {
        return this.store.evict(prefix);
    }

    sweep(): Promise<number> {
        return this.store.sweep();
    }

    clear(): Promise<void> {
        return this.store.clear();
    }
}

export const cacheManager = new CacheManager();

function buildCacheKey(cacheName: string, joinPoint: JoinPoint): string {
    return `${cacheName}:${joinPoint.className}.${joinPoint.methodName}:${JSON.stringify(joinPoint.args)}`;
}

export function Cacheable(cacheName: string, ttlSeconds: number = 60) {
    return Around(async (joinPoint, proceed) => {
        const key = buildCacheKey(cacheName, joinPoint);

        const cached = await cacheManager.get(key);
        if (cached !== undefined) {
            return cached;
        }

        const result = await proceed();
        await cacheManager.set(key, result, ttlSeconds);
        return result;
    });
}

export function CacheEvict(cacheName: string) {
    return Around(async (joinPoint, proceed) => {
        const result = await proceed();
        await cacheManager.evict(cacheName);
        return result;
    });
}

export function CachePut(cacheName: string, ttlSeconds: number = 60) {
    return Around(async (joinPoint, proceed) => {
        const result = await proceed();
        const key = buildCacheKey(cacheName, joinPoint);
        await cacheManager.set(key, result, ttlSeconds);
        return result;
    });
}

export function hasRedisConfigured(): boolean {
    return getFrameworkConfig().get("REDIS_URL") !== undefined;
}
