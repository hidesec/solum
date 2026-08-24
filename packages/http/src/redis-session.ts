import { SessionStore } from "./session";

type RedisClientV4 = {
    connect(): Promise<void>;
    get(key: string): Promise<string | null>;
    set(key: string, value: string, options?: { EX?: number }): Promise<void>;
    del(key: string): Promise<void>;
    keys(pattern: string): Promise<string[]>;
    disconnect(): Promise<void>;
};

export class RedisSessionStore implements SessionStore {
    private readonly prefix: string;

    constructor(
        private readonly client: RedisClientV4,
        options: { prefix?: string; ttlSeconds?: number } = {}
    ) {
        this.prefix = options.prefix ?? "solumjs:session:";
    }

    private key(id: string): string {
        return `${this.prefix}${id}`;
    }

    get(id: string): Record<string, unknown> | undefined {
        // Synchronous interface - return undefined, actual fetch happens async
        // This is a limitation of the current SessionStore interface
        return undefined;
    }

    async getAsync(id: string): Promise<Record<string, unknown> | undefined> {
        const data = await this.client.get(this.key(id));
        if (!data) return undefined;
        try {
            return JSON.parse(data) as Record<string, unknown>;
        } catch {
            return undefined;
        }
    }

    set(id: string, data: Record<string, unknown>): void {
        // Fire-and-forget for synchronous interface
        this.setAsync(id, data).catch(() => {});
    }

    async setAsync(id: string, data: Record<string, unknown>, ttlSeconds?: number): Promise<void> {
        const serialized = JSON.stringify(data);
        const options = ttlSeconds ? { EX: ttlSeconds } : undefined;
        await this.client.set(this.key(id), serialized, options);
    }

    destroy(id: string): void {
        this.destroyAsync(id).catch(() => {});
    }

    async destroyAsync(id: string): Promise<void> {
        await this.client.del(this.key(id));
    }

    async sweepAsync(): Promise<number> {
        const keys = await this.client.keys(`${this.prefix}*`);
        let removed = 0;
        for (const key of keys) {
            const ttl = await this.client.get(key);
            if (ttl === null) {
                await this.client.del(key);
                removed++;
            }
        }
        return removed;
    }
}

export async function connectRedisSessionStore(
    url: string,
    options: { prefix?: string; ttlSeconds?: number } = {}
): Promise<RedisSessionStore> {
    let redis: { createClient: (config: object) => RedisClientV4 };
    try {
        redis = (await import("redis")) as unknown as { createClient: (config: object) => RedisClientV4 };
    } catch {
        throw new Error('Redis session store requires the "redis" package. Install it with: npm install redis');
    }

    const client = redis.createClient({ url });
    await client.connect();
    return new RedisSessionStore(client, options);
}
