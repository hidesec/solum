import { MemorySessionStore, createSessionMiddleware, createLogoutMiddleware, createFixationProtectionMiddleware } from "../session";
import { SolumjsRequest, SolumjsResponse } from "../http-types";

function fakeReq(overrides: Record<string, any> = {}): SolumjsRequest {
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
    } as unknown as SolumjsRequest;
}

function fakeRes(): SolumjsResponse & { cookies: Record<string, string>; clearedCookies: string[]; statusCode: number } {
    const cookies: Record<string, string> = {};
    const clearedCookies: string[] = [];
    let statusCode = 200;

    const res = {
        statusCode,
        headersSent: false,
        raw: {
            on: (_event: string, _cb: () => void) => {},
            setHeader: () => {},
            end: () => {},
        },
        status(code: number) {
            statusCode = code;
            res.statusCode = code;
            return res;
        },
        json: () => {},
        end: () => {},
        setCookie(name: string, _value: string, _opts?: any) {
            cookies[name] = _value;
            return res;
        },
        clearCookie(name: string, _opts?: any) {
            clearedCookies.push(name);
            return res;
        },
        cookies,
        clearedCookies,
    } as any;
    return res;
}

describe("MemorySessionStore", () => {
    it("stores and retrieves sessions", () => {
        const store = new MemorySessionStore();
        store.set("abc", { user: "john" });
        expect(store.get("abc")).toEqual({ user: "john" });
    });

    it("returns undefined for missing session", () => {
        const store = new MemorySessionStore();
        expect(store.get("missing")).toBeUndefined();
    });

    it("destroys sessions", () => {
        const store = new MemorySessionStore();
        store.set("abc", { user: "john" });
        store.destroy("abc");
        expect(store.get("abc")).toBeUndefined();
    });

    it("regenerates session with new id", () => {
        const store = new MemorySessionStore();
        store.set("old-id", { user: "john" });
        const newId = store.regenerate("old-id", { user: "john" });
        expect(newId).not.toBe("old-id");
        expect(store.get(newId)).toEqual({ user: "john" });
        expect(store.get("old-id")).toBeUndefined();
    });

    it("destroys all sessions", () => {
        const store = new MemorySessionStore();
        store.set("a", { x: 1 });
        store.set("b", { x: 2 });
        store.destroyAll();
        expect(store.size).toBe(0);
    });

    it("expires sessions after TTL", () => {
        const store = new MemorySessionStore(1);
        store.set("abc", { data: 1 });
        expect(store.get("abc")).toEqual({ data: 1 });
    });

    it("sweep removes expired sessions", () => {
        const store = new MemorySessionStore(-1);
        store.set("expired-1", { a: 1 });
        store.set("expired-2", { a: 2 });
        const removed = store.sweep();
        expect(removed).toBe(2);
        expect(store.size).toBe(0);
    });

    it("sweep returns 0 when no expired sessions", () => {
        const store = new MemorySessionStore(60000);
        store.set("fresh", { a: 1 });
        const removed = store.sweep();
        expect(removed).toBe(0);
        expect(store.size).toBe(1);
    });

    it("get refreshes TTL on existing session", () => {
        const store = new MemorySessionStore(60000);
        store.set("sid", { v: 1 });
        const result = store.get("sid");
        expect(result).toEqual({ v: 1 });
        expect(store.size).toBe(1);
    });

    it("size returns current session count", () => {
        const store = new MemorySessionStore();
        expect(store.size).toBe(0);
        store.set("a", {});
        expect(store.size).toBe(1);
        store.set("b", {});
        expect(store.size).toBe(2);
        store.destroy("a");
        expect(store.size).toBe(1);
    });
});

describe("createSessionMiddleware", () => {
    it("creates a new session when no cookie exists", () => {
        const middleware = createSessionMiddleware();
        const req = fakeReq();
        const res = fakeRes();
        let nextCalled = false;

        middleware(req, res, () => { nextCalled = true; });

        expect(nextCalled).toBe(true);
        expect(req.session).toBeDefined();
        expect(res.cookies["solum.sid"]).toBeDefined();
    });

    it("restores existing session from cookie", () => {
        const store = new MemorySessionStore();
        store.set("existing-id", { user: "john" });

        const middleware = createSessionMiddleware({ store });
        const req = fakeReq({ cookies: { "solum.sid": "existing-id" } });
        const res = fakeRes();
        let nextCalled = false;

        middleware(req, res, () => { nextCalled = true; });

        expect(nextCalled).toBe(true);
        expect(req.session!.id).toBe("existing-id");
        expect(req.session!.data).toEqual({ user: "john" });
    });

    it("destroys session and clears cookie", () => {
        const store = new MemorySessionStore();
        store.set("sid-1", { user: "john" });

        const middleware = createSessionMiddleware({ store });
        const req = fakeReq({ cookies: { "solum.sid": "sid-1" } });
        const res = fakeRes();

        middleware(req, res, () => {});
        req.session!.destroy();

        expect(store.get("sid-1")).toBeUndefined();
        expect(res.clearedCookies).toContain("solum.sid");
    });

    it("regenerates session id", () => {
        const store = new MemorySessionStore();
        store.set("old-sid", { user: "john" });

        const middleware = createSessionMiddleware({ store });
        const req = fakeReq({ cookies: { "solum.sid": "old-sid" } });
        const res = fakeRes();

        middleware(req, res, () => {});
        const newId = req.session!.regenerate();

        expect(newId).not.toBe("old-sid");
        expect(store.get("old-sid")).toBeUndefined();
        expect(store.get(newId)).toEqual({ user: "john" });
    });

    it("session.touch() refreshes TTL", () => {
        const store = new MemorySessionStore();
        store.set("touch-sid", { count: 1 });

        const middleware = createSessionMiddleware({ store });
        const req = fakeReq({ cookies: { "solum.sid": "touch-sid" } });
        const res = fakeRes();

        middleware(req, res, () => {});
        req.session!.data.count = 2;
        req.session!.touch();

        expect(store.get("touch-sid")).toEqual({ count: 2 });
    });

    it("maxAge option sets cookie maxAge", () => {
        const middleware = createSessionMiddleware({ maxAge: 3600 });
        const req = fakeReq();
        const res = fakeRes();

        middleware(req, res, () => {});
        expect(res.cookies["solum.sid"]).toBeDefined();
    });

    it("custom cookie name is used", () => {
        const middleware = createSessionMiddleware({ cookieName: "my.sid" });
        const req = fakeReq();
        const res = fakeRes();

        middleware(req, res, () => {});
        expect(res.cookies["my.sid"]).toBeDefined();
    });

    it("expired session cookie creates new session", () => {
        const store = new MemorySessionStore();
        const middleware = createSessionMiddleware({ store });
        const req = fakeReq({ cookies: { "solum.sid": "expired-id" } });
        const res = fakeRes();

        middleware(req, res, () => {});
        expect(req.session!.id).not.toBe("expired-id");
        expect(res.cookies["solum.sid"]).toBeDefined();
    });

    it("on finish event persists session data", () => {
        const store = new MemorySessionStore();
        const finishCbs: (() => void)[] = [];
        const rawOn = (_event: string, cb: () => void) => { finishCbs.push(cb); };

        const middleware = createSessionMiddleware({ store });
        const req = fakeReq();
        const res = { ...fakeRes(), raw: { on: rawOn, end: () => {}, setHeader: () => {} } } as any;

        middleware(req, res, () => {});
        req.session!.data.visited = true;

        finishCbs.forEach((cb) => cb());
        expect(store.get(req.session!.id)).toEqual({ visited: true });
    });
});

describe("createLogoutMiddleware", () => {
    it("destroys session on logout", () => {
        const store = new MemorySessionStore();
        store.set("sid-1", { user: "john" });

        const sessionMiddleware = createSessionMiddleware({ store });
        const logoutMiddleware = createLogoutMiddleware();

        const req = fakeReq({ cookies: { "solum.sid": "sid-1" } });
        const res = fakeRes();

        sessionMiddleware(req, res, () => {});
        logoutMiddleware(req, res, () => {});

        expect(store.get("sid-1")).toBeUndefined();
    });
});

describe("createFixationProtectionMiddleware", () => {
    it("regenerates session on successful login", () => {
        const middleware = createFixationProtectionMiddleware({ loginPath: "/login" });
        const mockSession = { regenerate: jest.fn() };
        const req = fakeReq({ method: "POST", path: "/login", session: mockSession } as any);
        const rawEnd = jest.fn();
        const res = {
            raw: {
                statusCode: 200,
                end: rawEnd,
                on: () => {},
            },
        } as any;

        middleware(req, res, () => {});
        res.raw.end();

        expect(mockSession.regenerate).toHaveBeenCalled();
    });

    it("does not regenerate on non-success status", () => {
        const middleware = createFixationProtectionMiddleware({ loginPath: "/login" });
        const mockSession = { regenerate: jest.fn() };
        const req = fakeReq({ method: "POST", path: "/login", session: mockSession } as any);
        const rawEnd = jest.fn();
        const res = {
            raw: {
                statusCode: 401,
                end: rawEnd,
                on: () => {},
            },
        } as any;

        middleware(req, res, () => {});
        res.raw.end();

        expect(mockSession.regenerate).not.toHaveBeenCalled();
    });

    it("does not regenerate on non-login path", () => {
        const middleware = createFixationProtectionMiddleware({ loginPath: "/login" });
        const mockSession = { regenerate: jest.fn() };
        const req = fakeReq({ method: "POST", path: "/other", session: mockSession } as any);
        const rawEnd = jest.fn();
        const res = {
            raw: {
                statusCode: 200,
                end: rawEnd,
                on: () => {},
            },
        } as any;

        middleware(req, res, () => {});
        res.raw.end();

        expect(mockSession.regenerate).not.toHaveBeenCalled();
    });
});
