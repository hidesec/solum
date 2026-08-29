import { RedisSessionStore } from "../redis-session";

function createMockRedis() {
    const store = new Map<string, string>();
    return {
        store,
        get: jest.fn(async (key: string) => store.get(key) ?? null),
        set: jest.fn(async (key: string, value: string, opts?: { EX?: number }) => {
            store.set(key, value);
            return "OK";
        }),
        del: jest.fn(async (key: string) => {
            store.delete(key);
        }),
        keys: jest.fn(async (pattern: string) => {
            const prefix = pattern.replace("*", "");
            return Array.from(store.keys()).filter((k) => k.startsWith(prefix));
        }),
        connect: jest.fn(async () => {}),
        disconnect: jest.fn(async () => {}),
    };
}

describe("RedisSessionStore", () => {
    it("constructor sets default prefix", () => {
        const mock = createMockRedis();
        const store = new RedisSessionStore(mock as any);
        expect(store).toBeDefined();
    });

    it("constructor accepts custom prefix", () => {
        const mock = createMockRedis();
        const store = new RedisSessionStore(mock as any, { prefix: "custom:" });
        expect(store).toBeDefined();
    });

    it("getAsync fetches and parses JSON session", async () => {
        const mock = createMockRedis();
        mock.store.set("solumjs:session:abc", JSON.stringify({ user: "john" }));

        const store = new RedisSessionStore(mock as any);
        const result = await store.getAsync("abc");
        expect(result).toEqual({ user: "john" });
        expect(mock.get).toHaveBeenCalledWith("solumjs:session:abc");
    });

    it("getAsync returns undefined for missing key", async () => {
        const mock = createMockRedis();
        const store = new RedisSessionStore(mock as any);
        const result = await store.getAsync("missing");
        expect(result).toBeUndefined();
    });

    it("getAsync returns undefined for invalid JSON", async () => {
        const mock = createMockRedis();
        mock.store.set("solumjs:session:bad", "not-json");
        const store = new RedisSessionStore(mock as any);
        const result = await store.getAsync("bad");
        expect(result).toBeUndefined();
    });

    it("setAsync serializes and stores data", async () => {
        const mock = createMockRedis();
        const store = new RedisSessionStore(mock as any);
        await store.setAsync("xyz", { user: "jane" });

        expect(mock.set).toHaveBeenCalledWith(
            "solumjs:session:xyz",
            JSON.stringify({ user: "jane" }),
            undefined
        );
    });

    it("setAsync respects TTL", async () => {
        const mock = createMockRedis();
        const store = new RedisSessionStore(mock as any);
        await store.setAsync("ttl-sess", { data: 1 }, 3600);

        expect(mock.set).toHaveBeenCalledWith(
            "solumjs:session:ttl-sess",
            JSON.stringify({ data: 1 }),
            { EX: 3600 }
        );
    });

    it("destroyAsync deletes key", async () => {
        const mock = createMockRedis();
        mock.store.set("solumjs:session:del", "{}");
        const store = new RedisSessionStore(mock as any);
        await store.destroyAsync("del");
        expect(mock.del).toHaveBeenCalledWith("solumjs:session:del");
    });

    it("destroyAllAsync deletes all session keys", async () => {
        const mock = createMockRedis();
        mock.store.set("solumjs:session:a", "{}");
        mock.store.set("solumjs:session:b", "{}");
        mock.store.set("other:key", "x");
        const store = new RedisSessionStore(mock as any);
        await store.destroyAllAsync();
        expect(mock.del).toHaveBeenCalledTimes(2);
    });

    it("regenerate creates new id and deletes old", async () => {
        const mock = createMockRedis();
        mock.store.set("solumjs:session:old-id", JSON.stringify({ user: "john" }));
        const store = new RedisSessionStore(mock as any);
        const newId = store.regenerate("old-id", { user: "john" });

        expect(newId).not.toBe("old-id");
        expect(typeof newId).toBe("string");
        expect(newId.length).toBeGreaterThan(0);
    });

    it("regenerateAsync deletes old key and sets new one", async () => {
        const mock = createMockRedis();
        const store = new RedisSessionStore(mock as any);
        await store.regenerateAsync("old", "new", { user: "john" });

        expect(mock.del).toHaveBeenCalledWith("solumjs:session:old");
        expect(mock.set).toHaveBeenCalledWith(
            "solumjs:session:new",
            JSON.stringify({ user: "john" }),
            undefined
        );
    });

    it("sweepAsync removes keys with null value", async () => {
        const mock = createMockRedis();
        mock.store.set("solumjs:session:s1", "alive");
        mock.store.set("solumjs:session:s2", "alive");
        mock.get.mockImplementation(async (key: string) => {
            return key.includes("s1") ? "alive" : null;
        });

        const store = new RedisSessionStore(mock as any);
        const removed = await store.sweepAsync();
        expect(removed).toBe(1);
    });

    it("sweepAsync returns 0 when no keys to remove", async () => {
        const mock = createMockRedis();
        const store = new RedisSessionStore(mock as any);
        const removed = await store.sweepAsync();
        expect(removed).toBe(0);
    });

    it("get sync wrapper calls async version", () => {
        const mock = createMockRedis();
        const store = new RedisSessionStore(mock as any);
        const result = store.get("test");
        expect(result).toBeUndefined();
    });

    it("set sync wrapper calls async version", () => {
        const mock = createMockRedis();
        const store = new RedisSessionStore(mock as any);
        store.set("test", { data: 1 });
        expect(mock.set).toHaveBeenCalled();
    });

    it("destroy sync wrapper calls async version", () => {
        const mock = createMockRedis();
        const store = new RedisSessionStore(mock as any);
        store.destroy("test");
        expect(mock.del).toHaveBeenCalled();
    });

    it("destroyAll sync wrapper calls async version", () => {
        const mock = createMockRedis();
        const store = new RedisSessionStore(mock as any);
        store.destroyAll();
        expect(mock.keys).toHaveBeenCalled();
    });

    it("regenerate sync wrapper returns new id", () => {
        const mock = createMockRedis();
        const store = new RedisSessionStore(mock as any);
        const id = store.regenerate("old", { data: 1 });
        expect(typeof id).toBe("string");
        expect(id).not.toBe("old");
    });
});

describe("connectRedisSessionStore", () => {
    it("creates a store when redis is available", async () => {
        const { connectRedisSessionStore } = await import("../redis-session");
        const mockClient = {
            connect: jest.fn(async () => {}),
            get: jest.fn(async () => null),
            set: jest.fn(async () => "OK"),
            del: jest.fn(async () => 1),
            keys: jest.fn(async () => []),
            disconnect: jest.fn(async () => {}),
        };
        jest.mock("redis", () => ({
            createClient: () => mockClient,
        }));

        const store = await connectRedisSessionStore("redis://localhost:6379");
        expect(store).toBeDefined();
        jest.unmock("redis");
    });
});
