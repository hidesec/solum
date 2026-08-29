import { createRateLimit, createSecurityMiddlewares } from "../security.middleware";

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

describe("createRateLimit", () => {
    it("calls next when under limit", () => {
        const middleware = createRateLimit({ windowMs: 60000, max: 10 });
        const req = fakeReq();
        const res = fakeRes();
        let nextCalled = false;

        middleware(req, res, () => { nextCalled = true; });

        expect(nextCalled).toBe(true);
    });

    it("returns 429 when limit exceeded", () => {
        const middleware = createRateLimit({ windowMs: 60000, max: 0 });
        const req = fakeReq();
        const res = fakeRes();
        let nextCalled = false;

        middleware(req, res, () => { nextCalled = true; });

        expect(nextCalled).toBe(false);
        expect(res.statusCode).toBe(429);
    });

    it("sets rate limit headers", () => {
        const middleware = createRateLimit({ windowMs: 60000, max: 100 });
        const req = fakeReq();
        const res = fakeRes();

        middleware(req, res, () => {});

        expect(res.raw.setHeader).toHaveBeenCalledWith("ratelimit-policy", "100;w=60");
        expect(res.raw.setHeader).toHaveBeenCalledWith("ratelimit-limit", "100");
        expect(res.raw.setHeader).toHaveBeenCalledWith("ratelimit-remaining", "99");
    });
});

describe("createSecurityMiddlewares", () => {
    it("returns array of middlewares", () => {
        const middlewares = createSecurityMiddlewares();
        expect(Array.isArray(middlewares)).toBe(true);
        expect(middlewares.length).toBe(3);
    });

    it("security headers middleware sets all expected headers", () => {
        const middlewares = createSecurityMiddlewares();
        const securityHeaders = middlewares[0];
        const req = fakeReq();
        const res = fakeRes();
        let nextCalled = false;

        securityHeaders(req, res, () => { nextCalled = true; });

        expect(nextCalled).toBe(true);
        expect(res.raw.setHeader).toHaveBeenCalledWith("content-security-policy", expect.any(String));
        expect(res.raw.setHeader).toHaveBeenCalledWith("x-content-type-options", "nosniff");
        expect(res.raw.setHeader).toHaveBeenCalledWith("x-frame-options", "SAMEORIGIN");
        expect(res.raw.setHeader).toHaveBeenCalledWith("strict-transport-security", expect.any(String));
        expect(res.raw.setHeader).toHaveBeenCalledWith("x-xss-protection", "0");
    });
});
