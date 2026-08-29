import { mountActuator, prometheusMetrics } from "../actuator";

function createMockAdapter() {
    const routes: Array<{ method: string; path: string; handler: any }> = [];
    return {
        registerRoute(_basePath: string, route: any) {
            routes.push(route);
        },
        listen(_port: number, _cb?: () => void) {},
        close(_cb?: () => void) { if (_cb) _cb(); },
        routes,
        getRoute(method: string, routePath: string) {
            return routes.find((r) => r.method === method && r.path === routePath);
        },
        async invoke(method: string, routePath: string, req: any, res: any) {
            const route = routes.find((r) => r.method === method && r.path === routePath);
            if (!route) throw new Error(`Route ${method} ${routePath} not found`);
            await route.handler(req, res);
        },
    };
}

function createMockReq(opts: { remoteAddress?: string } = {}) {
    return {
        socket: { remoteAddress: opts.remoteAddress ?? "127.0.0.1" },
    } as any;
}

function createMockRes() {
    let statusCode = 200;
    let body: any;
    const res = {
        status(code: number) {
            statusCode = code;
            return res;
        },
        json(data: any) {
            body = data;
            return res;
        },
        raw: {
            setHeader(_k: string, _v: string) {},
            end(data?: string) {
                if (data !== undefined) body = data;
            },
        },
        _body: () => body,
        _status: () => statusCode,
    } as any;
    return res;
}

describe("mountActuator", () => {
    beforeEach(() => {
        prometheusMetrics["counters"]?.clear?.();
        prometheusMetrics["gauges"]?.clear?.();
        prometheusMetrics["histograms"]?.clear?.();
    });

    it("registers all standard actuator endpoints", () => {
        const adapter = createMockAdapter();
        mountActuator(adapter);

        const paths = adapter.routes.map((r) => r.path);
        expect(paths).toContain("/health");
        expect(paths).toContain("/metrics");
        expect(paths).toContain("/info");
        expect(paths).toContain("/beans");
        expect(paths).toContain("/mappings");
        expect(paths).toContain("/env");
        expect(paths).toContain("/loggers");
        expect(paths).toContain("/prometheus");
    });

    it("uses custom basePath", () => {
        const adapter = createMockAdapter();
        mountActuator(adapter, { basePath: "/admin/ops" });

        const paths = adapter.routes.map((r) => r.path);
        expect(paths).toContain("/health");
        expect(paths).toContain("/metrics");
    });

    it("health endpoint returns UP status", async () => {
        const adapter = createMockAdapter();
        mountActuator(adapter);

        const res = createMockRes();
        await adapter.invoke("get", "/health", createMockReq(), res);
        const body = res._body();
        expect(body.status).toBeDefined();
        expect(body.checks).toBeDefined();
    });

    it("metrics endpoint returns uptime and system info", async () => {
        const adapter = createMockAdapter();
        mountActuator(adapter);

        const res = createMockRes();
        await adapter.invoke("get", "/metrics", createMockReq(), res);
        const body = res._body();
        expect(body.uptime).toBeDefined();
        expect(body.uptimeMs).toBeGreaterThan(0);
        expect(body.system).toBeDefined();
        expect(body.system.nodeVersion).toBeDefined();
        expect(body.system.platform).toBeDefined();
    });

    it("info endpoint returns app info", async () => {
        const adapter = createMockAdapter();
        mountActuator(adapter);

        const res = createMockRes();
        await adapter.invoke("get", "/info", createMockReq(), res);
        const body = res._body();
        expect(body.app).toBeDefined();
        expect(body.build).toBeDefined();
    });

    it("info endpoint merges custom info", async () => {
        const adapter = createMockAdapter();
        mountActuator(adapter, { info: { custom: { key: "val" } } });

        const res = createMockRes();
        await adapter.invoke("get", "/info", createMockReq(), res);
        const body = res._body();
        expect(body.custom).toBeDefined();
        expect(body.custom.key).toBe("val");
    });

    it("beans endpoint returns bean list", async () => {
        const adapter = createMockAdapter();
        mountActuator(adapter);

        const res = createMockRes();
        await adapter.invoke("get", "/beans", createMockReq(), res);
        const body = res._body();
        expect(body.context).toBeDefined();
        expect(Array.isArray(body.context.beans)).toBe(true);
    });

    it("mappings endpoint returns route list", async () => {
        const adapter = createMockAdapter();
        adapter.routes.push(
            { method: "get", path: "/test", handler: () => {}, fullPath: "/api/test" } as any,
            { method: "post", path: "/create", handler: () => {}, fullPath: "/api/create" } as any,
        );
        mountActuator(adapter);

        const res = createMockRes();
        await adapter.invoke("get", "/mappings", createMockReq(), res);
        const body = res._body();
        expect(body.mappings).toBeDefined();
        expect(Array.isArray(body.mappings)).toBe(true);
    });

    it("env endpoint filters safe env vars", async () => {
        const adapter = createMockAdapter();
        mountActuator(adapter);

        const res = createMockRes();
        await adapter.invoke("get", "/env", createMockReq(), res);
        const body = res._body();
        expect(body.activeProfiles).toBeDefined();
        expect(body.propertySources).toBeDefined();
    });

    it("loggers endpoint returns log levels", async () => {
        const adapter = createMockAdapter();
        mountActuator(adapter);

        const res = createMockRes();
        await adapter.invoke("get", "/loggers", createMockReq(), res);
        const body = res._body();
        expect(body.levels).toEqual(["error", "warn", "info", "debug", "trace"]);
        expect(body.loggers.root).toBeDefined();
    });

    it("prometheus endpoint returns metrics text", async () => {
        const adapter = createMockAdapter();
        mountActuator(adapter);

        const res = createMockRes();
        await adapter.invoke("get", "/prometheus", createMockReq(), res);
        const output = res._body();
        expect(typeof output).toBe("string");
        expect(output).toContain("solum_");
    });

    it("prometheus can be disabled", () => {
        const adapter = createMockAdapter();
        mountActuator(adapter, { prometheus: { enabled: false } });

        const promRoute = adapter.routes.find((r) => r.path === "/prometheus");
        expect(promRoute).toBeUndefined();
    });

    it("custom endpoints are registered", async () => {
        const adapter = createMockAdapter();
        mountActuator(adapter, {
            customEndpoints: [
                { path: "/custom", method: "get", handler: (_req: any, res: any) => res.json({ custom: true }) },
            ],
        });

        const res = createMockRes();
        await adapter.invoke("get", "/custom", createMockReq(), res);
        expect(res._body().custom).toBe(true);
    });

    it("protected endpoint returns 403 for non-localhost without authGuard", async () => {
        const adapter = createMockAdapter();
        mountActuator(adapter);

        const res = createMockRes();
        await adapter.invoke("get", "/env", createMockReq({ remoteAddress: "192.168.1.100" }), res);
        expect(res._status()).toBe(403);
    });

    it("protected endpoint returns 401 when authGuard rejects", async () => {
        const adapter = createMockAdapter();
        mountActuator(adapter, {
            authGuard: () => false,
        });

        const res = createMockRes();
        await adapter.invoke("get", "/env", createMockReq(), res);
        expect(res._status()).toBe(401);
    });

    it("protected endpoint passes when authGuard accepts", async () => {
        const adapter = createMockAdapter();
        mountActuator(adapter, {
            authGuard: () => true,
        });

        const res = createMockRes();
        await adapter.invoke("get", "/env", createMockReq(), res);
        expect(res._status()).toBe(200);
    });
});
