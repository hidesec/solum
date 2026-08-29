import http from "http";
import fs from "fs";
import os from "os";
import path from "path";
import { NodeHttpAdapter } from "../node.adapter";
import { createSessionMiddleware } from "../session";

async function startAdapter(adapter: NodeHttpAdapter): Promise<{ server: http.Server; url: string }> {
    await new Promise<void>((resolve) => {
        adapter.listen(0, () => resolve());
    });
    const server = (adapter as unknown as { server: http.Server }).server;
    const address = server.address();
    const port = typeof address === "object" && address ? address.port : 0;
    return { server, url: `http://127.0.0.1:${port}` };
}

describe("NodeHttpAdapter integration", () => {
    let adapter: NodeHttpAdapter;
    let server: http.Server;
    let url: string;

    afterEach(async () => {
        await new Promise<void>((resolve) => server.close(() => resolve()));
    });

    it("round-trips cookies between responses and requests", async () => {
        adapter = new NodeHttpAdapter({ notFoundHandler: (_req, res) => res.status(404).json({}), errorHandler: (_err, _req, res) => res.status(500).json({}) });
        adapter.registerRoute("/", {
            method: "get",
            path: "/cookie/set",
            handler: (_req, res) => {
                res.setCookie("sid", "abc123").status(200).json({ ok: true });
            },
        });
        adapter.registerRoute("/", {
            method: "get",
            path: "/cookie/read",
            handler: (req, res) => res.status(200).json({ cookies: req.cookies ?? {} }),
        });
        ({ server, url } = await startAdapter(adapter));

        const setResponse = await fetch(`${url}/cookie/set`);
        expect(setResponse.headers.get("set-cookie")).toContain("sid=abc123");

        const readResponse = await fetch(`${url}/cookie/read`, {
            headers: { cookie: "sid=abc123" },
        });
        expect(await readResponse.json()).toEqual({ cookies: { sid: "abc123" } });
    });

    it("parses multipart uploads into fields and files", async () => {
        adapter = new NodeHttpAdapter({ notFoundHandler: (_req, res) => res.status(404).json({}), errorHandler: (_err, _req, res) => res.status(500).json({}) });
        adapter.registerRoute("/", {
            method: "post",
            path: "/upload",
            handler: (req, res) =>
                res.status(200).json({
                    fields: req.body,
                    files: (req.files ?? []).map((f) => ({
                        fieldname: f.fieldname,
                        filename: f.filename,
                        size: f.size,
                        mimeType: f.mimeType,
                    })),
                }),
        });
        ({ server, url } = await startAdapter(adapter));

        const form = new FormData();
        form.append("title", "Report");
        form.append("file", new Blob([Buffer.from("file-content")], { type: "text/plain" }), "note.txt");

        const response = await fetch(`${url}/upload`, { method: "POST", body: form });
        const payload = (await response.json()) as any;

        expect(payload.fields.title).toBe("Report");
        expect(payload.files).toHaveLength(1);
        expect(payload.files[0]).toMatchObject({
            fieldname: "file",
            filename: "note.txt",
            mimeType: "text/plain",
            size: 12,
        });
    });

    it("serves static files and blocks traversal", async () => {
        const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "solum-static-"));
        fs.writeFileSync(path.join(rootDir, "hello.txt"), "static-hello");

        adapter = new NodeHttpAdapter({ notFoundHandler: (_req, res) => res.status(404).json({}), errorHandler: (_err, _req, res) => res.status(500).json({}) });
        adapter.useStatic(rootDir);
        ({ server, url } = await startAdapter(adapter));

        const ok = await fetch(`${url}/static/hello.txt`);
        expect(ok.status).toBe(200);
        expect(ok.headers.get("content-type")).toContain("text/plain");
        expect(await ok.text()).toBe("static-hello");

        const traversal = await fetch(`${url}/static/../secret.txt`);
        expect([403, 404]).toContain(traversal.status);

        const missing = await fetch(`${url}/static/nope.txt`);
        expect(missing.status).toBe(404);

        fs.rmSync(rootDir, { recursive: true, force: true });
    });

    it("persists sessions across requests via cookie", async () => {
        adapter = new NodeHttpAdapter({ notFoundHandler: (_req, res) => res.status(404).json({}), errorHandler: (_err, _req, res) => res.status(500).json({}) });
        adapter.use(createSessionMiddleware({ cookieName: "test.sid" }));
        adapter.registerRoute("/", {
            method: "get",
            path: "/visit",
            handler: (req, res) => {
                const session = req.session!;
                const count = Number(session.data.count ?? 0) + 1;
                session.data.count = count;
                res.status(200).json({ id: session.id, count });
            },
        });
        ({ server, url } = await startAdapter(adapter));

        const first = await fetch(`${url}/visit`);
        const firstBody = (await first.json()) as any;
        const setCookie = first.headers.get("set-cookie") ?? "";
        expect(setCookie).toContain("test.sid=");

        const second = await fetch(`${url}/visit`, {
            headers: { cookie: `test.sid=${firstBody.id}` },
        });
        const secondBody = (await second.json()) as any;

        expect(secondBody.id).toBe(firstBody.id);
        expect(secondBody.count).toBe(2);
    });

    it("streams server-sent events until closed", async () => {
        adapter = new NodeHttpAdapter({ notFoundHandler: (_req, res) => res.status(404).json({}), errorHandler: (_err, _req, res) => res.status(500).json({}) });
        adapter.registerRoute("/", {
            method: "get",
            path: "/events",
            handler: (req, res) => {
                const stream = res.sse();
                stream.comment("hello");
                stream.send({ n: 1 });
                stream.send("done", "finish");
                stream.close();
            },
        });
        ({ server, url } = await startAdapter(adapter));

        const response = await fetch(`${url}/events`);
        expect(response.headers.get("content-type")).toContain("text/event-stream");
        const text = await response.text();
        expect(text).toContain(": hello");
        expect(text).toContain('data: {"n":1}');
        expect(text).toContain("event: finish\ndata: done");
    });

    it("parses urlencoded bodies", async () => {
        adapter = new NodeHttpAdapter({ notFoundHandler: (_req, res) => res.status(404).json({}), errorHandler: (_err, _req, res) => res.status(500).json({}) });
        adapter.registerRoute("/", {
            method: "post",
            path: "/form",
            handler: (req, res) => res.status(200).json(req.body),
        });
        ({ server, url } = await startAdapter(adapter));

        const response = await fetch(`${url}/form`, {
            method: "POST",
            headers: { "content-type": "application/x-www-form-urlencoded" },
            body: "name=ada&lang=ts",
        });
        expect(await response.json()).toEqual({ name: "ada", lang: "ts" });
    });

    it("rejects body exceeding bodyLimitBytes", async () => {
        adapter = new NodeHttpAdapter({
            bodyLimitBytes: 10,
            notFoundHandler: (_req, res) => res.status(404).json({}),
            errorHandler: (err, _req, res) => res.status(413).json({ error: err.message }),
        });
        adapter.registerRoute("/", {
            method: "post",
            path: "/echo",
            handler: (req, res) => res.status(200).json(req.body),
        });
        ({ server, url } = await startAdapter(adapter));

        const response = await fetch(`${url}/echo`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ data: "x".repeat(100) }),
        });
        expect(response.status).toBe(413);
    });

    it("accepts body within bodyLimitBytes", async () => {
        adapter = new NodeHttpAdapter({
            bodyLimitBytes: 1024,
            notFoundHandler: (_req, res) => res.status(404).json({}),
            errorHandler: (err, _req, res) => res.status(500).json({ error: err.message }),
        });
        adapter.registerRoute("/", {
            method: "post",
            path: "/echo",
            handler: (req, res) => res.status(200).json({ ok: true }),
        });
        ({ server, url } = await startAdapter(adapter));

        const response = await fetch(`${url}/echo`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ small: true }),
        });
        expect(response.status).toBe(200);
    });

    it("handleJSON parses application/json bodies", async () => {
        adapter = new NodeHttpAdapter({ notFoundHandler: (_req, res) => res.status(404).json({}), errorHandler: (_err, _req, res) => res.status(500).json({}) });
        adapter.registerRoute("/", {
            method: "post",
            path: "/json",
            handler: (req, res) => res.status(200).json(req.body),
        });
        ({ server, url } = await startAdapter(adapter));

        const response = await fetch(`${url}/json`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ key: "val" }),
        });
        expect(await response.json()).toEqual({ key: "val" });
    });

    it("addInterceptors delegates to global interceptor registry", async () => {
        const { resetInterceptors, addInterceptors, resolveInterceptors } = await import("../interceptor");
        resetInterceptors();

        const marker = { called: false };
        const testInterceptor = {
            preHandle(_req: any, _res: any) {
                marker.called = true;
                return true;
            },
        };

        adapter = new NodeHttpAdapter({ notFoundHandler: (_req, res) => res.status(404).json({}), errorHandler: (_err, _req, res) => res.status(500).json({}) });
        adapter.addInterceptors(testInterceptor);

        const resolved = resolveInterceptors("GET", "/test");
        expect(resolved.length).toBeGreaterThanOrEqual(1);
        expect(resolved[0]).toBe(testInterceptor);

        resetInterceptors();
    });

    it("addInterceptors with pattern filtering registers scoped interceptor", async () => {
        const { resetInterceptors, resolveInterceptors } = await import("../interceptor");
        resetInterceptors();

        const scopedInterceptor = {
            preHandle(_req: any, _res: any) { return true; },
        };

        adapter = new NodeHttpAdapter({ notFoundHandler: (_req, res) => res.status(404).json({}), errorHandler: (_err, _req, res) => res.status(500).json({}) });
        adapter.addInterceptors(scopedInterceptor, { patterns: ["/api/*"] });

        const resolvedForApi = resolveInterceptors("GET", "/api/data");
        expect(resolvedForApi.length).toBeGreaterThanOrEqual(1);

        const resolvedForOther = resolveInterceptors("GET", "/other");
        const found = resolvedForOther.find((i) => i === scopedInterceptor);
        expect(found).toBeUndefined();

        resetInterceptors();
    });

    it("adapter.use registers middleware that runs before handlers", async () => {
        const order: string[] = [];

        adapter = new NodeHttpAdapter({ notFoundHandler: (_req, res) => res.status(404).json({}), errorHandler: (_err, _req, res) => res.status(500).json({}) });
        adapter.use((_req, _res, next) => { order.push("middleware"); next(); });
        adapter.registerRoute("/", {
            method: "get",
            path: "/order",
            handler: (_req, res) => { order.push("handler"); res.status(200).json({}); },
        });
        ({ server, url } = await startAdapter(adapter));

        await fetch(`${url}/order`);
        expect(order).toEqual(["middleware", "handler"]);
    });

    it("adapter handles 404 for unmatched routes", async () => {
        adapter = new NodeHttpAdapter({ notFoundHandler: (_req, res) => res.status(404).json({ error: "not found" }), errorHandler: (_err, _req, res) => res.status(500).json({}) });
        adapter.registerRoute("/", {
            method: "get",
            path: "/exists",
            handler: (_req, res) => res.status(200).json({ ok: true }),
        });
        ({ server, url } = await startAdapter(adapter));

        const response = await fetch(`${url}/does-not-exist`);
        expect(response.status).toBe(404);
    });

    it("adapter handles method mismatch as 404", async () => {
        adapter = new NodeHttpAdapter({ notFoundHandler: (_req, res) => res.status(404).json({}), errorHandler: (_err, _req, res) => res.status(500).json({}) });
        adapter.registerRoute("/", {
            method: "post",
            path: "/only-post",
            handler: (_req, res) => res.status(200).json({ ok: true }),
        });
        ({ server, url } = await startAdapter(adapter));

        const response = await fetch(`${url}/only-post`);
        expect(response.status).toBe(404);
    });

    it("adapter handles multiple middlewares in order", async () => {
        const order: string[] = [];

        adapter = new NodeHttpAdapter({ notFoundHandler: (_req, res) => res.status(404).json({}), errorHandler: (_err, _req, res) => res.status(500).json({}) });
        adapter.use((_req, _res, next) => { order.push("first"); next(); });
        adapter.use((_req, _res, next) => { order.push("second"); next(); });
        adapter.registerRoute("/", {
            method: "get",
            path: "/multi",
            handler: (_req, res) => { order.push("handler"); res.status(200).json({}); },
        });
        ({ server, url } = await startAdapter(adapter));

        await fetch(`${url}/multi`);
        expect(order).toEqual(["first", "second", "handler"]);
    });

    it("adapter handles error thrown in middleware", async () => {
        adapter = new NodeHttpAdapter({
            notFoundHandler: (_req, res) => res.status(404).json({}),
            errorHandler: (err, _req, res) => res.status(500).json({ error: err.message }),
        });
        adapter.use((_req, _res, _next) => { throw new Error("middleware error"); });
        adapter.registerRoute("/", {
            method: "get",
            path: "/err",
            handler: (_req, res) => res.status(200).json({}),
        });
        ({ server, url } = await startAdapter(adapter));

        const response = await fetch(`${url}/err`);
        expect(response.status).toBe(500);
    });

    it("adapter handles query parameters", async () => {
        adapter = new NodeHttpAdapter({ notFoundHandler: (_req, res) => res.status(404).json({}), errorHandler: (_err, _req, res) => res.status(500).json({}) });
        adapter.registerRoute("/", {
            method: "get",
            path: "/query",
            handler: (req, res) => res.status(200).json({ query: req.query }),
        });
        ({ server, url } = await startAdapter(adapter));

        const response = await fetch(`${url}/query?foo=bar&n=42`);
        const body = await response.json() as any;
        expect(body.query.foo).toBe("bar");
        expect(body.query.n).toBe("42");
    });

    it("adapter handles path parameters", async () => {
        adapter = new NodeHttpAdapter({ notFoundHandler: (_req, res) => res.status(404).json({}), errorHandler: (_err, _req, res) => res.status(500).json({}) });
        adapter.registerRoute("/", {
            method: "get",
            path: "/users/:id",
            handler: (req, res) => res.status(200).json({ id: req.params.id }),
        });
        ({ server, url } = await startAdapter(adapter));

        const response = await fetch(`${url}/users/42`);
        const body = await response.json() as any;
        expect(body.id).toBe("42");
    });

    it("adapter handles DELETE method", async () => {
        adapter = new NodeHttpAdapter({ notFoundHandler: (_req, res) => res.status(404).json({}), errorHandler: (_err, _req, res) => res.status(500).json({}) });
        adapter.registerRoute("/", {
            method: "delete",
            path: "/del",
            handler: (_req, res) => res.status(204).end(),
        });
        ({ server, url } = await startAdapter(adapter));

        const response = await fetch(`${url}/del`, { method: "DELETE" });
        expect(response.status).toBe(204);
    });

    it("adapter handles PUT method with JSON body", async () => {
        adapter = new NodeHttpAdapter({ notFoundHandler: (_req, res) => res.status(404).json({}), errorHandler: (_err, _req, res) => res.status(500).json({}) });
        adapter.registerRoute("/", {
            method: "put",
            path: "/update",
            handler: (req, res) => res.status(200).json({ received: req.body }),
        });
        ({ server, url } = await startAdapter(adapter));

        const response = await fetch(`${url}/update`, {
            method: "PUT",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ name: "updated" }),
        });
        const body = await response.json() as any;
        expect(body.received.name).toBe("updated");
    });

    it("adapter handles PATCH method", async () => {
        adapter = new NodeHttpAdapter({ notFoundHandler: (_req, res) => res.status(404).json({}), errorHandler: (_err, _req, res) => res.status(500).json({}) });
        adapter.registerRoute("/", {
            method: "patch",
            path: "/patch",
            handler: (req, res) => res.status(200).json({ patched: req.body }),
        });
        ({ server, url } = await startAdapter(adapter));

        const response = await fetch(`${url}/patch`, {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ field: "val" }),
        });
        const body = await response.json() as any;
        expect(body.patched.field).toBe("val");
    });
});
