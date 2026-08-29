import { createRedisRateLimit } from "../redis-rate-limit";

function fakeReq(overrides: Record<string, any> = {}): any {
    return {
        method: "GET",
        path: "/",
        params: {},
        query: {},
        headers: {},
        body: {},
        log: { info: () => {}, warn: () => {}, error: () => {} },
        raw: {
            socket: { remoteAddress: "127.0.0.1" },
            setHeader: jest.fn(),
        },
        cookies: {},
        ...overrides,
    };
}

function fakeRes(): any {
    let statusCode = 200;
    const res = {
        get statusCode() { return statusCode; },
        status(code: number) { statusCode = code; return res; },
        json: jest.fn(),
        raw: {
            setHeader: jest.fn(),
            socket: { remoteAddress: "127.0.0.1" },
        },
    };
    return res;
}

function createMockRedis(fail = false) {
    let count = 0;
    return {
        incr: jest.fn(async () => {
            if (fail) throw new Error("Redis connection failed");
            return ++count;
        }),
        expire: jest.fn(async () => {}),
        pttl: jest.fn(async () => 60000),
        del: jest.fn(async () => {}),
        get: jest.fn(async () => null),
        set: jest.fn(async () => {}),
    };
}

describe("createRedisRateLimit", () => {
    it("calls next when under limit", async () => {
        const redis = createMockRedis();
        const middleware = createRedisRateLimit({ redis, windowMs: 60000, max: 10 });
        const req = fakeReq();
        const res = fakeRes();
        let nextCalled = false;

        await middleware(req, res, () => { nextCalled = true; });

        expect(nextCalled).toBe(true);
    });

    it("returns 429 when limit exceeded", async () => {
        const redis = createMockRedis();
        const middleware = createRedisRateLimit({ redis, windowMs: 60000, max: 0 });
        const req = fakeReq();
        const res = fakeRes();
        let nextCalled = false;

        await middleware(req, res, () => { nextCalled = true; });

        expect(nextCalled).toBe(false);
        expect(res.statusCode).toBe(429);
    });

    it("sets rate limit headers", async () => {
        const redis = createMockRedis();
        const middleware = createRedisRateLimit({ redis, windowMs: 60000, max: 100 });
        const req = fakeReq();
        const res = fakeRes();

        await middleware(req, res, () => {});

        expect(redis.incr).toHaveBeenCalled();
        expect(redis.expire).toHaveBeenCalled();
    });

    it("returns 503 when Redis throws", async () => {
        const redis = createMockRedis(true);
        const middleware = createRedisRateLimit({ redis, windowMs: 60000, max: 10 });
        const req = fakeReq();
        const res = fakeRes();
        let nextCalled = false;

        await middleware(req, res, () => { nextCalled = true; });

        expect(nextCalled).toBe(false);
        expect(res.statusCode).toBe(503);
    });

    it("uses trustProxy for IP detection", async () => {
        const redis = createMockRedis();
        const middleware = createRedisRateLimit({
            redis,
            windowMs: 60000,
            max: 10,
            trustProxy: true,
        });
        const req = fakeReq({
            headers: { "x-forwarded-for": "10.0.0.1, 10.0.0.2" },
        });
        const res = fakeRes();
        let nextCalled = false;

        await middleware(req, res, () => { nextCalled = true; });

        expect(nextCalled).toBe(true);
    });

    it("uses custom keyPrefix", async () => {
        const redis = createMockRedis();
        const middleware = createRedisRateLimit({
            redis,
            windowMs: 60000,
            max: 10,
            keyPrefix: "myapp:",
        });
        const req = fakeReq();
        const res = fakeRes();

        await middleware(req, res, () => {});

        expect(redis.incr).toHaveBeenCalledWith("myapp:127.0.0.1");
    });
});
