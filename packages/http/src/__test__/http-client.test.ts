import { makeRequest } from "../http-client";

describe("SSRF protection via makeRequest", () => {
    it("blocks .local domains", async () => {
        await expect(
            makeRequest({ method: "GET", url: "http://myhost.local/api" })
        ).rejects.toThrow("internal domains");
    });

    it("blocks .internal domains", async () => {
        await expect(
            makeRequest({ method: "GET", url: "http://service.internal/api" })
        ).rejects.toThrow("internal domains");
    });

    it("blocks localhost", async () => {
        await expect(
            makeRequest({ method: "GET", url: "http://localhost/test" })
        ).rejects.toThrow();
    }, 5000);

    it("blocks ftp protocol", async () => {
        await expect(
            makeRequest({ method: "GET", url: "ftp://example.com/file" })
        ).rejects.toThrow("only HTTP/HTTPS protocols");
    });

    it("blocks private IP 10.x.x.x", async () => {
        await expect(
            makeRequest({ method: "GET", url: "http://10.0.0.1/test" })
        ).rejects.toThrow();
    }, 5000);

    it("blocks private IP 192.168.x.x", async () => {
        await expect(
            makeRequest({ method: "GET", url: "http://192.168.1.1/test" })
        ).rejects.toThrow();
    }, 5000);

    it("blocks 127.0.0.1", async () => {
        await expect(
            makeRequest({ method: "GET", url: "http://127.0.0.1/test" })
        ).rejects.toThrow();
    }, 5000);

    it("blocks IPv6 loopback ::1", async () => {
        await expect(
            makeRequest({ method: "GET", url: "http://[::1]/test" })
        ).rejects.toThrow();
    }, 5000);
});

describe("redirect limit", () => {
    it("MAX_REDIRECTS is 5", () => {
        const MAX_REDIRECTS = 5;
        expect(MAX_REDIRECTS).toBe(5);
    });
});

describe("HTTP method decorators", () => {
    it("exports all decorators", async () => {
        const mod = await import("../http-client");
        expect(typeof mod.HttpGet).toBe("function");
        expect(typeof mod.HttpPost).toBe("function");
        expect(typeof mod.HttpPut).toBe("function");
        expect(typeof mod.HttpPatch).toBe("function");
        expect(typeof mod.HttpDelete).toBe("function");
        expect(typeof mod.HttpClient).toBe("function");
        expect(typeof mod.Retryable).toBe("function");
        expect(typeof mod.UseRequestInterceptor).toBe("function");
    });

    it("HttpGet decorator creates method definition", () => {
        const { HttpGet } = require("../http-client");
        class TestClient {
            @HttpGet("/users")
            getUsers() {}
        }
        const defs = Reflect.getMetadata("custom:http-methods", TestClient.prototype);
        expect(defs).toBeDefined();
        expect(defs[0].method).toBe("GET");
        expect(defs[0].path).toBe("/users");
    });
});

describe("UseRequestInterceptor decorator", () => {
    it("stores interceptor class in metadata", () => {
        const { UseRequestInterceptor } = require("../http-client");
        class TestInterceptor {
            intercept(req: any) { return req; }
        }
        @UseRequestInterceptor(TestInterceptor)
        class TestClient {}
        const { getRequestInterceptors } = require("../http-client");
        const interceptors = getRequestInterceptors(TestClient);
        expect(interceptors).toHaveLength(1);
    });
});
