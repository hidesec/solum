import { CacheManager } from "../cache.decorator";
import { DisposableCacheEntry, AsyncDisposableCacheEntry } from "../disposable-cache";
import { RedisCacheStore } from "../redis.connection";

describe("DisposableCacheEntry", () => {
    let manager: CacheManager;

    beforeEach(() => {
        manager = new CacheManager();
    });

    it("sets value in cache on construction", async () => {
        const entry = new DisposableCacheEntry(manager, "key1", { data: "test" }, 300);
        expect(entry.value).toEqual({ data: "test" });
        expect(await manager.get("key1")).toEqual({ data: "test" });
    });

    it("evicts key on dispose", async () => {
        const entry = new DisposableCacheEntry(manager, "key2", "hello", 300);
        expect(await manager.get("key2")).toBe("hello");
        entry[Symbol.dispose]();
        expect(await manager.get("key2")).toBeUndefined();
    });

    it("only evicts once (idempotent)", async () => {
        const entry = new DisposableCacheEntry(manager, "key3", "val", 300);
        entry[Symbol.dispose]();
        entry[Symbol.dispose]();
        expect(await manager.get("key3")).toBeUndefined();
    });

    it("preserves value until disposed", async () => {
        const entry = new DisposableCacheEntry(manager, "key4", 42, 300);
        expect(entry.value).toBe(42);
        expect(await manager.get("key4")).toBe(42);
        entry[Symbol.dispose]();
    });
});

describe("AsyncDisposableCacheEntry", () => {
    let manager: CacheManager;

    beforeEach(() => {
        manager = new CacheManager();
    });

    it("sets value in cache on construction", async () => {
        const entry = new AsyncDisposableCacheEntry(manager, "akey1", { data: "test" }, 300);
        expect(entry.value).toEqual({ data: "test" });
        expect(await manager.get("akey1")).toEqual({ data: "test" });
    });

    it("evicts key on async dispose", async () => {
        const entry = new AsyncDisposableCacheEntry(manager, "akey2", "hello", 300);
        expect(await manager.get("akey2")).toBe("hello");
        await entry[Symbol.asyncDispose]();
        expect(await manager.get("akey2")).toBeUndefined();
    });

    it("only evicts once (idempotent)", async () => {
        const entry = new AsyncDisposableCacheEntry(manager, "akey3", "val", 300);
        await entry[Symbol.asyncDispose]();
        await entry[Symbol.asyncDispose]();
        expect(await manager.get("akey3")).toBeUndefined();
    });
});

describe("RedisCacheStore", () => {
    function createMockRedis() {
        const store = new Map<string, string>();
        return {
            get: jest.fn(async (key: string) => store.get(key) ?? null),
            set: jest.fn(async (key: string, value: string, opts?: { EX?: number }) => {
                store.set(key, value);
            }),
            del: jest.fn(async (...keys: string[]) => {
                let count = 0;
                for (const k of keys) {
                    if (store.delete(k)) count++;
                }
                return count;
            }),
            keys: jest.fn(async (pattern: string) => {
                const prefix = pattern.replace("*", "");
                return Array.from(store.keys()).filter((k) => k.startsWith(prefix));
            }),
            scan: jest.fn(async (_cursor: number, opts: any) => {
                const prefix = (opts.MATCH as string).replace("*", "");
                const matching = Array.from(store.keys()).filter((k) => k.startsWith(prefix));
                return { cursor: 0, keys: matching };
            }),
            _store: store,
        };
    }

    it("name is 'redis'", () => {
        const store = new RedisCacheStore(createMockRedis() as any);
        expect(store.name).toBe("redis");
    });

    it("get returns parsed JSON value", async () => {
        const redis = createMockRedis();
        redis._store.set("solumjs:cache:user:1", JSON.stringify({ name: "John" }));
        const store = new RedisCacheStore(redis as any);

        const result = await store.get("user:1");
        expect(result).toEqual({ name: "John" });
    });

    it("get returns undefined for missing key", async () => {
        const store = new RedisCacheStore(createMockRedis() as any);
        const result = await store.get("missing");
        expect(result).toBeUndefined();
    });

    it("set stores JSON-serialized value with TTL", async () => {
        const redis = createMockRedis();
        const store = new RedisCacheStore(redis as any);

        await store.set("key1", { value: 42 }, 300);
        expect(redis.set).toHaveBeenCalledWith("solumjs:cache:key1", JSON.stringify({ value: 42 }), { EX: 300 });
    });

    it("evict removes matching keys via SCAN", async () => {
        const redis = createMockRedis();
        redis._store.set("solumjs:cache:user:1", "a");
        redis._store.set("solumjs:cache:user:2", "b");
        redis._store.set("solumjs:cache:post:1", "c");
        const store = new RedisCacheStore(redis as any);

        await store.evict("user:");
        expect(redis.del).toHaveBeenCalledWith("solumjs:cache:user:1", "solumjs:cache:user:2");
    });

    it("clear removes all cached keys", async () => {
        const redis = createMockRedis();
        redis._store.set("solumjs:cache:a", "1");
        redis._store.set("solumjs:cache:b", "2");
        const store = new RedisCacheStore(redis as any);

        await store.clear();
        expect(redis.del).toHaveBeenCalled();
    });

    it("sweep returns 0", async () => {
        const store = new RedisCacheStore(createMockRedis() as any);
        expect(await store.sweep()).toBe(0);
    });
});
