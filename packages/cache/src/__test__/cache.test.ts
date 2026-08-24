import { InMemoryCacheStore, CacheManager, resolveCacheKey } from "../cache.decorator";

describe("InMemoryCacheStore", () => {
    let store: InMemoryCacheStore;

    beforeEach(() => {
        store = new InMemoryCacheStore(5);
    });

    it("should return undefined for non-existent key", async () => {
        expect(await store.get("missing")).toBeUndefined();
    });

    it("should store and retrieve values", async () => {
        await store.set("key1", { name: "test" }, 60);
        expect(await store.get("key1")).toEqual({ name: "test" });
    });

    it("should return undefined for expired entries", async () => {
        await store.set("key1", "value1", -1);
        expect(await store.get("key1")).toBeUndefined();
    });

    it("should evict entries by prefix", async () => {
        await store.set("users:1", { id: 1 }, 60);
        await store.set("users:2", { id: 2 }, 60);
        await store.set("products:1", { id: 1 }, 60);

        await store.evict("users");

        expect(await store.get("users:1")).toBeUndefined();
        expect(await store.get("users:2")).toBeUndefined();
        expect(await store.get("products:1")).toEqual({ id: 1 });
    });

    it("should evict exact match", async () => {
        await store.set("users:list", { list: true }, 60);
        await store.set("users:1", { id: 1 }, 60);

        await store.evict("users:list");

        expect(await store.get("users:list")).toBeUndefined();
        expect(await store.get("users:1")).toEqual({ id: 1 });
    });

    it("should sweep expired entries", async () => {
        await store.set("active", "alive", 60);
        await store.set("expired", "dead", -1);

        const removed = await store.sweep();
        expect(removed).toBe(1);
        expect(await store.get("active")).toBe("alive");
        expect(await store.get("expired")).toBeUndefined();
    });

    it("should clear all entries", async () => {
        await store.set("key1", "v1", 60);
        await store.set("key2", "v2", 60);

        await store.clear();

        expect(await store.get("key1")).toBeUndefined();
        expect(await store.get("key2")).toBeUndefined();
    });

    it("should evict oldest entry when max entries reached", async () => {
        const smallStore = new InMemoryCacheStore(3);

        await smallStore.set("a", 1, 60);
        await smallStore.set("b", 2, 60);
        await smallStore.set("c", 3, 60);
        await smallStore.set("d", 4, 60);

        expect(await smallStore.get("a")).toBeUndefined();
        expect(await smallStore.get("b")).toBe(2);
        expect(await smallStore.get("d")).toBe(4);
    });

    it("should skip values larger than 1MB", async () => {
        const largeValue = "x".repeat(1024 * 1024 + 1);
        await store.set("large", largeValue, 60);
        expect(await store.get("large")).toBeUndefined();
    });

    it("should have correct name", () => {
        expect(store.name).toBe("in-memory");
    });
});

describe("CacheManager", () => {
    let manager: CacheManager;

    beforeEach(() => {
        manager = new CacheManager();
    });

    it("should use InMemoryCacheStore by default", () => {
        expect(manager.storeName).toBe("in-memory");
    });

    it("should delegate get/set to store", async () => {
        await manager.set("key1", { data: 123 }, 60);
        expect(await manager.get("key1")).toEqual({ data: 123 });
    });

    it("should delegate evict to store", async () => {
        await manager.set("prefix:1", "v1", 60);
        await manager.set("prefix:2", "v2", 60);
        await manager.evict("prefix");
        expect(await manager.get("prefix:1")).toBeUndefined();
    });

    it("should delegate sweep to store", async () => {
        await manager.set("expired", "v", -1);
        expect(await manager.sweep()).toBe(1);
    });

    it("should delegate clear to store", async () => {
        await manager.set("k1", "v1", 60);
        await manager.clear();
        expect(await manager.get("k1")).toBeUndefined();
    });

    it("should allow swapping store", async () => {
        const customStore = {
            name: "custom",
            get: jest.fn().mockResolvedValue("custom-value"),
            set: jest.fn().mockResolvedValue(undefined),
            evict: jest.fn().mockResolvedValue(undefined),
            sweep: jest.fn().mockResolvedValue(0),
            clear: jest.fn().mockResolvedValue(undefined),
        };

        manager.useStore(customStore as any);
        expect(manager.storeName).toBe("custom");
        expect(await manager.get("any")).toBe("custom-value");
        expect(customStore.get).toHaveBeenCalledWith("any");
    });
});

describe("resolveCacheKey", () => {
    it("should resolve positional arguments with {0}, {1}", () => {
        expect(resolveCacheKey("user:{0}", ["abc123"])).toBe("user:abc123");
        expect(resolveCacheKey("user:{0}:{1}", ["abc", "xyz"])).toBe("user:abc:xyz");
    });

    it("should resolve named arguments with methodParams", () => {
        expect(resolveCacheKey("user:{id}", ["abc123"], ["id"])).toBe("user:abc123");
        expect(resolveCacheKey("user:{id}:post:{postId}", ["u1", "p1"], ["id", "postId"])).toBe("user:u1:post:p1");
    });

    it("should handle missing arguments", () => {
        expect(resolveCacheKey("user:{0}", [])).toBe("user:_MISSING_0_");
        expect(resolveCacheKey("user:{id}", [], ["id"])).toBe("user:_MISSING_id_");
    });

    it("should handle null/undefined values", () => {
        expect(resolveCacheKey("user:{0}", [null])).toBe("user:null");
        expect(resolveCacheKey("user:{0}", [undefined])).toBe("user:null");
    });

    it("should stringify objects", () => {
        expect(resolveCacheKey("user:{0}", [{ name: "test" }])).toBe("user:[object Object]");
    });
});
