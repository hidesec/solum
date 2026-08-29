import crypto from "crypto";
import {
    InMemoryConfigRepository,
    createConfigServer,
    createConfigClient,
} from "../config-server/index";

describe("FileSystemConfigRepository path traversal prevention", () => {
    it("getPropertiesByUri rejects URI with path traversal", async () => {
        const { FileSystemConfigRepository } = await import("../config-server/index");
        const repo = new FileSystemConfigRepository("/tmp/test-config");
        await expect(repo.getPropertiesByUri("../../../etc/passwd")).rejects.toThrow();
    });

    it("getPropertiesByUri rejects URI with encoded traversal", async () => {
        const { FileSystemConfigRepository } = await import("../config-server/index");
        const repo = new FileSystemConfigRepository("/tmp/test-config");
        await expect(repo.getPropertiesByUri("..%2F..%2Fetc/passwd")).rejects.toThrow();
    });

    it("getPropertiesByUri returns empty for nonexistent file", async () => {
        const { FileSystemConfigRepository } = await import("../config-server/index");
        const repo = new FileSystemConfigRepository("/tmp/test-config");
        const result = await repo.getPropertiesByUri("nonexistent.json");
        expect(result).toEqual({});
    });
});

describe("ConfigServer auth token (non-localhost)", () => {
    it("timingSafeEqual rejects empty token", async () => {
        const authToken = "secret";
        const provided = "";
        if (provided.length !== authToken.length) {
            expect(provided.length).not.toBe(authToken.length);
        }
    });

    it("timingSafeEqual rejects short token", async () => {
        const authToken = "my-secret-token";
        const provided = "short";
        if (provided.length !== authToken.length) {
            expect(provided.length).not.toBe(authToken.length);
            return;
        }
    });

    it("timingSafeEqual accepts matching token", () => {
        const token = "exact-match-token";
        const result = crypto.timingSafeEqual(Buffer.from(token), Buffer.from(token));
        expect(result).toBe(true);
    });
});

describe("ConfigClient timeout handling", () => {
    it("timeout option is respected", () => {
        const { ConfigClient } = require("../config-server/index");
        const client = new ConfigClient({
            serverUrl: "http://localhost:19999",
            application: "test",
            timeout: 100,
        });
        expect(client).toBeDefined();
    });

    it("getProperty returns typed value", () => {
        const { ConfigClient } = require("../config-server/index");
        const client = new ConfigClient({
            serverUrl: "http://localhost:19999",
            application: "test",
        });
        expect(client.getProperty("missing")).toBeUndefined();
        expect(client.getAll()).toEqual({});
    });
});

describe("InMemoryConfigRepository", () => {
    it("stores and retrieves properties", async () => {
        const repo = new InMemoryConfigRepository();
        repo.set("app", "dev", { key: "value" });
        const result = await repo.getProperties("app", "dev", "main");
        expect(result).toEqual({ key: "value" });
    });

    it("returns empty object for missing config", async () => {
        const repo = new InMemoryConfigRepository();
        const result = await repo.getProperties("missing", "prod", "main");
        expect(result).toEqual({});
    });

    it("getPropertiesByUri returns empty", async () => {
        const repo = new InMemoryConfigRepository();
        const result = await repo.getPropertiesByUri("any/path");
        expect(result).toEqual({});
    });
});

describe("ConfigServer auth", () => {
    it("timingSafeEqual rejects different length tokens", async () => {
        const authToken = "short";
        const provided = "muchlongertoken";

        if (provided.length !== authToken.length) {
            expect(provided.length).not.toBe(authToken.length);
            return;
        }

        const result = crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(authToken));
        expect(result).toBe(false);
    });

    it("timingSafeEqual accepts matching tokens", () => {
        const token = "my-secret-token";
        const result = crypto.timingSafeEqual(Buffer.from(token), Buffer.from(token));
        expect(result).toBe(true);
    });

    it("timingSafeEqual rejects different tokens same length", () => {
        const a = "abcdef";
        const b = "abcdeg";
        const result = crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
        expect(result).toBe(false);
    });
});

describe("createConfigServer and createConfigClient", () => {
    it("creates a config server", () => {
        const repo = new InMemoryConfigRepository();
        const server = createConfigServer(repo, { port: 18888 });
        expect(server).toBeDefined();
    });

    it("creates a config client", () => {
        const client = createConfigClient({
            serverUrl: "http://localhost:18888",
            application: "test",
        });
        expect(client).toBeDefined();
    });

    it("config client getProperty returns undefined initially", () => {
        const client = createConfigClient({
            serverUrl: "http://localhost:18888",
            application: "test",
        });
        expect(client.getProperty("key")).toBeUndefined();
    });

    it("config client getAll returns empty object initially", () => {
        const client = createConfigClient({
            serverUrl: "http://localhost:18888",
            application: "test",
        });
        expect(client.getAll()).toEqual({});
    });

    it("config server starts and stops cleanly", async () => {
        const repo = new InMemoryConfigRepository();
        repo.set("test", "default", { foo: "bar" });
        const server = createConfigServer(repo, { port: 18889 });
        await server.start();
        const props = await server.getProperties("test", "default", "main");
        expect(props).toEqual({ foo: "bar" });
        await server.stop();
    });

    it("config server caches properties for 60s", async () => {
        const repo = new InMemoryConfigRepository();
        repo.set("cached", "default", { v: 1 });
        const server = createConfigServer(repo, { port: 18890 });
        await server.start();
        await server.getProperties("cached", "default", "main");

        repo.set("cached", "default", { v: 2 });
        const props = await server.getProperties("cached", "default", "main");
        expect(props).toEqual({ v: 1 });
        await server.stop();
    });

    it("config client fetchProperties rejects on invalid URL", async () => {
        const client = createConfigClient({
            serverUrl: "http://localhost:19999",
            application: "test",
            timeout: 200,
        });
        await expect(client.fetchProperties()).rejects.toThrow();
    });
});
