import fs from "fs";
import path from "path";
import os from "os";
import { PassThrough } from "stream";
import { serveStatic } from "../static";

function fakeReq(method: string, urlPath: string): any {
    return {
        method,
        path: urlPath,
        url: urlPath,
        headers: {},
    };
}

function fakeRes(): any {
    let statusCode = 200;
    const headers: Record<string, string | number> = {};
    const rawStream = new PassThrough();
    const rawSetHeader = jest.fn((k: string, v: string | number) => { headers[k] = v; });
    const rawEnd = jest.fn(() => rawStream.end());
    const rawEndBound = rawEnd.bind(rawStream);
    return {
        get statusCode() { return statusCode; },
        status(code: number) { statusCode = code; return this; },
        raw: Object.assign(rawStream, {
            setHeader: rawSetHeader,
            end: rawEndBound,
            get statusCode() { return statusCode; },
        }),
        setHeader: rawSetHeader,
        headers,
        json: jest.fn(),
        end: jest.fn(),
        get headersSent() { return false; },
    };
}

describe("serveStatic", () => {
    let tmpDir: string;

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "static-test-"));
    });

    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it("serves a static file", () => {
        fs.writeFileSync(path.join(tmpDir, "hello.txt"), "hello world");
        const middleware = serveStatic(tmpDir, { prefix: "/static" });
        const req = fakeReq("GET", "/static/hello.txt");
        const res = fakeRes();

        middleware(req, res, () => {});

        expect(res.setHeader).toHaveBeenCalledWith("content-type", "text/plain; charset=utf-8");
        expect(res.setHeader).toHaveBeenCalledWith("content-length", 11);
    });

    it("serves index.html for directory requests", () => {
        fs.writeFileSync(path.join(tmpDir, "index.html"), "<h1>Home</h1>");
        const middleware = serveStatic(tmpDir, { prefix: "/static" });
        const req = fakeReq("GET", "/static/");
        const res = fakeRes();

        middleware(req, res, () => {});

        expect(res.setHeader).toHaveBeenCalledWith("content-type", "text/html; charset=utf-8");
    });

    it("calls next() for non-GET/HEAD methods", () => {
        const next = jest.fn();
        const middleware = serveStatic(tmpDir, { prefix: "/static" });
        const req = fakeReq("POST", "/static/file.txt");
        const res = fakeRes();

        middleware(req, res, next);
        expect(next).toHaveBeenCalled();
    });

    it("calls next() when file not found (fallthrough=true)", () => {
        const next = jest.fn();
        const middleware = serveStatic(tmpDir, { prefix: "/static", fallthrough: true });
        const req = fakeReq("GET", "/static/nonexistent.txt");
        const res = fakeRes();

        middleware(req, res, next);
        expect(next).toHaveBeenCalled();
    });

    it("returns 404 when file not found (fallthrough=false)", () => {
        const next = jest.fn();
        const middleware = serveStatic(tmpDir, { prefix: "/static", fallthrough: false });
        const req = fakeReq("GET", "/static/nonexistent.txt");
        const res = fakeRes();

        middleware(req, res, next);
        expect(next).not.toHaveBeenCalled();
        expect(res.statusCode).toBe(404);
    });

    it("blocks path traversal attempts", () => {
        fs.writeFileSync(path.join(tmpDir, "secret.txt"), "secret");
        const next = jest.fn();
        const middleware = serveStatic(tmpDir, { prefix: "/static" });
        const req = fakeReq("GET", "/static/../../../etc/passwd");
        const res = fakeRes();

        middleware(req, res, next);
        expect(next).toHaveBeenCalled();
    });

    it("blocks symlinks (fallthrough=true)", () => {
        const target = path.join(tmpDir, "target.txt");
        const link = path.join(tmpDir, "link.txt");
        fs.writeFileSync(target, "content");
        fs.symlinkSync(target, link);

        const next = jest.fn();
        const middleware = serveStatic(tmpDir, { prefix: "/static" });
        const req = fakeReq("GET", "/static/link.txt");
        const res = fakeRes();

        middleware(req, res, next);
        expect(next).toHaveBeenCalled();
    });

    it("blocks symlinks (fallthrough=false)", () => {
        const target = path.join(tmpDir, "target.txt");
        const link = path.join(tmpDir, "link.txt");
        fs.writeFileSync(target, "content");
        fs.symlinkSync(target, link);

        const next = jest.fn();
        const middleware = serveStatic(tmpDir, { prefix: "/static", fallthrough: false });
        const req = fakeReq("GET", "/static/link.txt");
        const res = fakeRes();

        middleware(req, res, next);
        expect(next).not.toHaveBeenCalled();
        expect(res.statusCode).toBe(403);
    });

    it("sets cache-control header when maxAge > 0", () => {
        fs.writeFileSync(path.join(tmpDir, "cached.js"), "var x = 1;");
        const middleware = serveStatic(tmpDir, { prefix: "/static", maxAgeSeconds: 3600 });
        const req = fakeReq("GET", "/static/cached.js");
        const res = fakeRes();

        middleware(req, res, () => {});

        expect(res.setHeader).toHaveBeenCalledWith("cache-control", "public, max-age=3600");
    });

    it("detects correct MIME types", () => {
        const cases: [string, string, string][] = [
            ["test.html", "/static/test.html", "text/html; charset=utf-8"],
            ["style.css", "/static/style.css", "text/css; charset=utf-8"],
            ["app.js", "/static/app.js", "application/javascript; charset=utf-8"],
            ["data.json", "/static/data.json", "application/json; charset=utf-8"],
            ["image.png", "/static/image.png", "image/png"],
            ["image.jpg", "/static/image.jpg", "image/jpeg"],
            ["font.woff2", "/static/font.woff2", "font/woff2"],
        ];

        for (const [file, url, expectedType] of cases) {
            fs.writeFileSync(path.join(tmpDir, file), "content");
            const middleware = serveStatic(tmpDir, { prefix: "/static" });
            const req = fakeReq("GET", url);
            const res = fakeRes();
            middleware(req, res, () => {});
            expect(res.setHeader).toHaveBeenCalledWith("content-type", expectedType);
        }
    });

    it("HEAD request serves headers without body", () => {
        fs.writeFileSync(path.join(tmpDir, "head.txt"), "content");
        const middleware = serveStatic(tmpDir, { prefix: "/static" });
        const req = fakeReq("HEAD", "/static/head.txt");
        const res = fakeRes();

        middleware(req, res, () => {});

        expect(res.setHeader).toHaveBeenCalledWith("content-type", "text/plain; charset=utf-8");
    });

    it("calls next() when request path does not match prefix", () => {
        const next = jest.fn();
        const middleware = serveStatic(tmpDir, { prefix: "/static" });
        const req = fakeReq("GET", "/other/path");
        const res = fakeRes();

        middleware(req, res, next);
        expect(next).toHaveBeenCalled();
    });

    it("falls through for directories", () => {
        fs.mkdirSync(path.join(tmpDir, "subdir"));
        const next = jest.fn();
        const middleware = serveStatic(tmpDir, { prefix: "/static" });
        const req = fakeReq("GET", "/static/subdir");
        const res = fakeRes();

        middleware(req, res, next);
        expect(next).toHaveBeenCalled();
    });

    it("unknown extension uses application/octet-stream", () => {
        fs.writeFileSync(path.join(tmpDir, "file.xyz"), "data");
        const middleware = serveStatic(tmpDir, { prefix: "/static" });
        const req = fakeReq("GET", "/static/file.xyz");
        const res = fakeRes();
        middleware(req, res, () => {});
        expect(res.setHeader).toHaveBeenCalledWith("content-type", "application/octet-stream");
    });
});
