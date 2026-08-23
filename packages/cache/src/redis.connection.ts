import { CacheStore } from "./cache.decorator";

type RedisClientV4 = {
    connect(): Promise<void>;
    get(key: string): Promise<string | null>;
    set(key: string, value: string, options?: { EX?: number }): Promise<unknown>;
    del(...keys: string[]): Promise<number>;
    keys(pattern: string): Promise<string[]>;
    on(event: string, listener: (...args: unknown[]) => void): void;
    isOpen: boolean;
};

const KEY_PREFIX = "solumjs:cache:";

export async function connectRedis(url: string): Promise<RedisClientV4> {
    let redis: { createClient: (cfg: object) => RedisClientV4 };
    try {
        redis = (await import("redis")) as unknown as { createClient: (cfg: object) => RedisClientV4 };
    } catch {
        throw new Error('REDIS_URL is set but the "redis" package is not installed. Install it with: npm install redis');
    }

    const client = redis.createClient({ url });
    client.on("error", () => {
    });
    await client.connect();
    return client;
}

export class RedisCacheStore implements CacheStore {
    readonly name = "redis";

    constructor(private readonly client: RedisClientV4) {}

    async get<T>(key: string): Promise<T | undefined> {
        const raw = await this.client.get(KEY_PREFIX + key);
        if (raw === null) return undefined;
        return JSON.parse(raw) as T;
    }

    async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
        await this.client.set(KEY_PREFIX + key, JSON.stringify(value), { EX: ttlSeconds });
    }

    async evict(prefix: string): Promise<void> {
        const pattern = `${KEY_PREFIX}${prefix}*`;
        const keys = await this.client.keys(pattern);
        if (keys.length > 0) {
            await this.client.del(...keys);
        }
    }

    async sweep(): Promise<number> {
        return 0;
    }

    async clear(): Promise<void> {
        const keys = await this.client.keys(`${KEY_PREFIX}*`);
        if (keys.length > 0) {
            await this.client.del(...keys);
        }
    }
}
