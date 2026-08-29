import { csrfProtection } from "../csrf.middleware";

function fakeReq(overrides: Record<string, any> = {}): any {
    return {
        method: "GET",
        path: "/",
        params: {},
        query: {},
        headers: {},
        body: {},
        log: { info: () => {}, warn: () => {}, error: () => {} },
        raw: {},
        cookies: {},
        ...overrides,
    };
}

function fakeRes(): any {
    const headers: Record<string, string> = {};
    let statusCode = 200;
    return {
        get statusCode() { return statusCode; },
        raw: {
            setHeader: (k: string, v: string) => { headers[k] = v; },
            get statusCode() { return statusCode; },
        },
        status(code: number) { statusCode = code; return this; },
        json: jest.fn(),
        headers,
    };
}

describe("csrfProtection", () => {
    it("throws if secret is missing", () => {
        expect(() => csrfProtection({ secret: "" })).toThrow("at least 32 characters");
    });

    it("throws if secret is too short", () => {
        expect(() => csrfProtection({ secret: "short" })).toThrow("at least 32 characters");
    });

    it("accepts secret >= 32 characters", () => {
        expect(() => csrfProtection({ secret: "a".repeat(32) })).not.toThrow();
    });

    it("GET request sets token cookie and header", () => {
        const middleware = csrfProtection({ secret: "a".repeat(32) });
        const req = fakeReq({ method: "GET" });
        const res = fakeRes();
        let nextCalled = false;

        middleware(req, res, () => { nextCalled = true; });

        expect(nextCalled).toBe(true);
        expect(res.headers["Set-Cookie"]).toBeDefined();
        expect(res.headers["Set-Cookie"].toString()).toContain("_csrf=");
        expect(res.headers["X-CSRF-Token"]).toBeDefined();
        expect(res.headers["X-CSRF-Token"].length).toBe(64);
    });

    it("HEAD request sets token (ignored method)", () => {
        const middleware = csrfProtection({ secret: "a".repeat(32) });
        const req = fakeReq({ method: "HEAD" });
        const res = fakeRes();
        let nextCalled = false;

        middleware(req, res, () => { nextCalled = true; });

        expect(nextCalled).toBe(true);
        expect(res.headers["X-CSRF-Token"]).toBeDefined();
    });

    it("POST returns 403 when cookie missing", () => {
        const middleware = csrfProtection({ secret: "a".repeat(32) });
        const req = fakeReq({ method: "POST", headers: {} });
        const res = fakeRes();

        middleware(req, res, () => {});

        expect(res.statusCode).toBe(403);
    });

    it("POST returns 403 when token is malformed", () => {
        const middleware = csrfProtection({ secret: "a".repeat(32) });
        const req = fakeReq({ method: "POST", headers: { cookie: "_csrf=no-dot" } });
        const res = fakeRes();

        middleware(req, res, () => {});

        expect(res.statusCode).toBe(403);
    });

    it("POST returns 403 when signature is invalid", () => {
        const crypto = require("crypto");
        const secret = "a".repeat(32);
        const token = crypto.randomBytes(32).toString("hex");
        const badSig = crypto.randomBytes(32).toString("hex");

        const middleware = csrfProtection({ secret });
        const req = fakeReq({
            method: "POST",
            headers: { cookie: `_csrf=${token}.${badSig}` },
        });
        const res = fakeRes();

        middleware(req, res, () => {});

        expect(res.statusCode).toBe(403);
    });

    it("POST returns 403 when header token mismatches cookie token", () => {
        const crypto = require("crypto");
        const secret = "a".repeat(32);
        const token = crypto.randomBytes(32).toString("hex");
        const hmac = crypto.createHmac("sha256", secret);
        hmac.update(token);
        const signature = hmac.digest("hex");

        const middleware = csrfProtection({ secret });
        const req = fakeReq({
            method: "POST",
            headers: {
                cookie: `_csrf=${token}.${signature}`,
                "x-csrf-token": "0".repeat(64),
            },
        });
        const res = fakeRes();

        middleware(req, res, () => {});

        expect(res.statusCode).toBe(403);
    });

    it("POST succeeds with valid token and matching header", () => {
        const crypto = require("crypto");
        const secret = "a".repeat(32);
        const token = crypto.randomBytes(32).toString("hex");
        const hmac = crypto.createHmac("sha256", secret);
        hmac.update(token);
        const signature = hmac.digest("hex");

        const middleware = csrfProtection({ secret });
        const req = fakeReq({
            method: "POST",
            headers: {
                cookie: `_csrf=${token}.${signature}`,
                "x-csrf-token": token,
            },
        });
        const res = fakeRes();
        let nextCalled = false;

        middleware(req, res, () => { nextCalled = true; });

        expect(nextCalled).toBe(true);
    });

    it("uses custom cookie and header names", () => {
        const middleware = csrfProtection({
            secret: "a".repeat(32),
            cookieName: "custom_csrf",
            headerName: "x-custom-csrf",
        });
        const req = fakeReq({ method: "GET" });
        const res = fakeRes();

        middleware(req, res, () => {});

        expect(res.headers["Set-Cookie"].toString()).toContain("custom_csrf=");
        expect(res.headers["X-CSRF-Token"]).toBeDefined();
    });

    it("custom ignore methods work", () => {
        const middleware = csrfProtection({
            secret: "a".repeat(32),
            ignoreMethods: ["GET"],
        });
        const req = fakeReq({ method: "HEAD" });
        const res = fakeRes();

        middleware(req, res, () => {});

        expect(res.statusCode).toBe(403);
    });
});
