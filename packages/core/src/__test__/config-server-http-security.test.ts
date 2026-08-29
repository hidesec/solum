import http from "http";
import fs from "fs";
import path from "path";
import os from "os";
import { InMemoryConfigRepository } from "../config-server/index";

function makeRequest(port: number, urlPath: string, headers: Record<string, string> = {}): Promise<{ status: number; body: string }> {
    return new Promise((resolve, reject) => {
        const req = http.get(`http://127.0.0.1:${port}${urlPath}`, { headers }, (res) => {
            let body = "";
            res.on("data", (chunk) => { body += chunk; });
            res.on("end", () => resolve({ status: res.statusCode!, body }));
        });
        req.on("error", reject);
        req.setTimeout(3000, () => { req.destroy(); reject(new Error("timeout")); });
    });
}

describe("FileSystemConfigRepository sanitizeName", () => {
    let tmpDir: string;

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "config-server-test-"));
    });

    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it("getProperties rejects application name with path traversal", async () => {
        const { FileSystemConfigRepository } = await import("../config-server/index");
        const repo = new FileSystemConfigRepository(tmpDir);
        await expect(repo.getProperties("../../../etc", "default", "main")).rejects.toThrow("Invalid application or profile name");
    });

    it("getProperties rejects profile name with special chars", async () => {
        const { FileSystemConfigRepository } = await import("../config-server/index");
        const repo = new FileSystemConfigRepository(tmpDir);
        await expect(repo.getProperties("app", "../etc", "main")).rejects.toThrow("Invalid application or profile name");
    });

    it("getProperties accepts valid names", async () => {
        const { FileSystemConfigRepository } = await import("../config-server/index");
        const repo = new FileSystemConfigRepository(tmpDir);
        const result = await repo.getProperties("my-app", "production", "main");
        expect(result).toEqual({});
    });

    it("getProperties accepts names with dots and dashes", async () => {
        const { FileSystemConfigRepository } = await import("../config-server/index");
        const repo = new FileSystemConfigRepository(tmpDir);
        const result = await repo.getProperties("app-v2.test", "prod-east", "main");
        expect(result).toEqual({});
    });

    it("getPropertiesByUri rejects URI with encoded traversal", async () => {
        const { FileSystemConfigRepository } = await import("../config-server/index");
        const repo = new FileSystemConfigRepository(tmpDir);
        await expect(repo.getPropertiesByUri("..%2F..%2Fetc/passwd")).rejects.toThrow();
    });

    it("getPropertiesByUri rejects URI with double dots", async () => {
        const { FileSystemConfigRepository } = await import("../config-server/index");
        const repo = new FileSystemConfigRepository(tmpDir);
        await expect(repo.getPropertiesByUri("foo..bar")).rejects.toThrow();
    });
});

describe("sanitizeName behavior via FileSystemConfigRepository", () => {
    let tmpDir: string;

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "sanitize-test-"));
    });

    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it("rejects name with semicolons (shell injection)", async () => {
        const { FileSystemConfigRepository } = await import("../config-server/index");
        const repo = new FileSystemConfigRepository(tmpDir);
        await expect(repo.getProperties("app;rm -rf /", "default", "main")).rejects.toThrow();
    });

    it("rejects name with backticks (command substitution)", async () => {
        const { FileSystemConfigRepository } = await import("../config-server/index");
        const repo = new FileSystemConfigRepository(tmpDir);
        await expect(repo.getProperties("`whoami`", "default", "main")).rejects.toThrow();
    });

    it("rejects name with $ (variable expansion)", async () => {
        const { FileSystemConfigRepository } = await import("../config-server/index");
        const repo = new FileSystemConfigRepository(tmpDir);
        await expect(repo.getProperties("app$(id)", "default", "main")).rejects.toThrow();
    });

    it("rejects name with spaces", async () => {
        const { FileSystemConfigRepository } = await import("../config-server/index");
        const repo = new FileSystemConfigRepository(tmpDir);
        await expect(repo.getProperties("my app", "default", "main")).rejects.toThrow();
    });

    it("rejects name exceeding 128 characters", async () => {
        const { FileSystemConfigRepository } = await import("../config-server/index");
        const repo = new FileSystemConfigRepository(tmpDir);
        const longName = "a".repeat(129);
        await expect(repo.getProperties(longName, "default", "main")).rejects.toThrow();
    });
});

describe("ConfigServer HTTP security", () => {
    const { createConfigServer } = require("../config-server/index");

    afterEach(async () => {
        await new Promise((r) => setTimeout(r, 100));
    });

    it("responds to valid request on localhost", async () => {
        const repo = new InMemoryConfigRepository();
        repo.set("testapp", "default", { key: "value" });
        const server = createConfigServer(repo, { port: 18891 });
        await server.start();
        try {
            const result = await makeRequest(18891, "/testapp/default/main");
            expect(result.status).toBe(200);
            expect(JSON.parse(result.body)).toEqual({ key: "value" });
        } finally {
            await server.stop();
        }
    });

    it("returns generic error message (not leaking internals)", async () => {
        const failingRepo = {
            getProperties: () => Promise.reject(new Error("Secret DB password is abc123")),
            getPropertiesByUri: () => Promise.reject(new Error("Secret")),
        };
        const server = createConfigServer(failingRepo, { port: 18892 });
        await server.start();
        try {
            const result = await makeRequest(18892, "/app/default/main");
            expect(result.status).toBe(500);
            const body = JSON.parse(result.body);
            expect(body.error).toBe("Failed to load configuration");
            expect(body.error).not.toContain("Secret DB password");
        } finally {
            await server.stop();
        }
    });

    it("localhost bypasses auth (isLocalhost check)", async () => {
        const repo = new InMemoryConfigRepository();
        repo.set("testapp", "default", { key: "value" });
        const server = createConfigServer(repo, { port: 18893, authToken: "secret-token-1234" });
        await server.start();
        try {
            const result = await makeRequest(18893, "/testapp/default/main");
            expect(result.status).toBe(200);
        } finally {
            await server.stop();
        }
    });

    it("returns correct properties for application/profile/label", async () => {
        const repo = new InMemoryConfigRepository();
        repo.set("myapp", "staging", { debug: true, port: 8080 });
        const server = createConfigServer(repo, { port: 18894 });
        await server.start();
        try {
            const result = await makeRequest(18894, "/myapp/staging/main");
            expect(result.status).toBe(200);
            expect(JSON.parse(result.body)).toEqual({ debug: true, port: 8080 });
        } finally {
            await server.stop();
        }
    });

    it("returns empty object for missing config", async () => {
        const repo = new InMemoryConfigRepository();
        const server = createConfigServer(repo, { port: 18895 });
        await server.start();
        try {
            const result = await makeRequest(18895, "/nonexistent/default/main");
            expect(result.status).toBe(200);
            expect(JSON.parse(result.body)).toEqual({});
        } finally {
            await server.stop();
        }
    });
});
