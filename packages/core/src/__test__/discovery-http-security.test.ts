import http from "http";

function httpRequest(port: number, options: http.RequestOptions, body?: string): Promise<{ status: number; body: string }> {
    return new Promise((resolve, reject) => {
        const headers: Record<string, string | number> = { ...(options.headers as Record<string, string> || {}) };
        if (body) {
            headers["Content-Length"] = Buffer.byteLength(body);
        }
        const req = http.request({ hostname: "127.0.0.1", port, ...options, headers }, (res) => {
            let data = "";
            res.on("data", (chunk) => { data += chunk; });
            res.on("end", () => resolve({ status: res.statusCode!, body: data }));
        });
        req.on("error", reject);
        req.setTimeout(3000, () => { req.destroy(); reject(new Error("timeout")); });
        if (body) req.write(body);
        req.end();
    });
}

describe("Discovery registry HTTP security", () => {
    const { startRegistry, stopRegistry } = require("../discovery/index");

    afterEach(async () => {
        await stopRegistry();
        await new Promise((r) => setTimeout(r, 100));
    });

    it("registry starts on 127.0.0.1 (not 0.0.0.0)", async () => {
        const server = startRegistry({ port: 18771 });
        expect(server).toBeDefined();
        const addr = server.address();
        expect(typeof addr).toBe("object");
        if (addr && typeof addr === "object") {
            expect(addr.address).toBe("127.0.0.1");
        }
        await stopRegistry();
    });

    it("accepts registration from localhost", async () => {
        startRegistry({ port: 18772 });
        const result = await httpRequest(18772, {
            method: "POST",
            path: "/register",
            headers: { "Content-Type": "application/json" },
        }, JSON.stringify({ serviceId: "test-svc", host: "127.0.0.1", port: 3001 }));
        expect(result.status).toBe(200);
        await stopRegistry();
    });

    it("accepts discovery from localhost", async () => {
        startRegistry({ port: 18773 });
        await httpRequest(18773, {
            method: "POST",
            path: "/register",
            headers: { "Content-Type": "application/json" },
        }, JSON.stringify({ serviceId: "disc-svc", host: "127.0.0.1", port: 3002 }));
        const result = await httpRequest(18773, {
            method: "GET",
            path: "/discovery?serviceId=disc-svc",
        });
        expect(result.status).toBe(200);
        const body = JSON.parse(result.body);
        expect(body).toHaveLength(1);
        await stopRegistry();
    });

    it("rejects registration without required fields", async () => {
        startRegistry({ port: 18774 });
        const result = await httpRequest(18774, {
            method: "POST",
            path: "/register",
            headers: { "Content-Type": "application/json" },
        }, JSON.stringify({}));
        expect(result.status).toBe(400);
        await stopRegistry();
    });

    it("returns empty for unknown service", async () => {
        startRegistry({ port: 18775 });
        const result = await httpRequest(18775, {
            method: "GET",
            path: "/discovery?serviceId=nonexistent-svc",
        });
        expect(result.status).toBe(200);
        expect(JSON.parse(result.body)).toHaveLength(0);
        await stopRegistry();
    });

    it("heartbeat updates instance", async () => {
        startRegistry({ port: 18776 });
        await httpRequest(18776, {
            method: "POST",
            path: "/register",
            headers: { "Content-Type": "application/json" },
        }, JSON.stringify({ serviceId: "hb-svc", host: "127.0.0.1", port: 3003 }));
        const result = await httpRequest(18776, {
            method: "POST",
            path: "/heartbeat",
            headers: { "Content-Type": "application/json" },
        }, JSON.stringify({ serviceId: "hb-svc", host: "127.0.0.1", port: 3003 }));
        expect(result.status).toBe(200);
        await stopRegistry();
    });

    it("deregistration removes instance", async () => {
        startRegistry({ port: 18777 });
        await httpRequest(18777, {
            method: "POST",
            path: "/register",
            headers: { "Content-Type": "application/json" },
        }, JSON.stringify({ serviceId: "del-svc", host: "127.0.0.1", port: 3004 }));
        const result = await httpRequest(18777, {
            method: "DELETE",
            path: "/deregister",
            headers: { "Content-Type": "application/json" },
        }, JSON.stringify({ serviceId: "del-svc", host: "127.0.0.1", port: 3004 }));
        expect(result.status).toBe(200);
        const check = await httpRequest(18777, {
            method: "GET",
            path: "/discovery?serviceId=del-svc",
        });
        expect(JSON.parse(check.body)).toHaveLength(0);
        await stopRegistry();
    });

    it("localhost always bypasses auth check", async () => {
        startRegistry({ port: 18778, authToken: "secret-token" });
        const result = await httpRequest(18778, {
            method: "POST",
            path: "/register",
            headers: {
                "Content-Type": "application/json",
            },
        }, JSON.stringify({ serviceId: "local-svc", host: "127.0.0.1", port: 3007 }));
        expect(result.status).toBe(200);
        await stopRegistry();
    });

    it("list all instances returns all registered services", async () => {
        startRegistry({ port: 18779 });
        await httpRequest(18779, {
            method: "POST",
            path: "/register",
            headers: { "Content-Type": "application/json" },
        }, JSON.stringify({ serviceId: "svc-a", host: "127.0.0.1", port: 4001 }));
        await httpRequest(18779, {
            method: "POST",
            path: "/register",
            headers: { "Content-Type": "application/json" },
        }, JSON.stringify({ serviceId: "svc-b", host: "127.0.0.1", port: 4002 }));
        const result = await httpRequest(18779, {
            method: "GET",
            path: "/discovery",
        });
        expect(result.status).toBe(200);
        const body = JSON.parse(result.body);
        expect(Object.keys(body)).toContain("svc-a");
        expect(Object.keys(body)).toContain("svc-b");
        await stopRegistry();
    });

    it("returns 400 for invalid JSON body on register", async () => {
        startRegistry({ port: 18780 });
        const result = await httpRequest(18780, {
            method: "POST",
            path: "/register",
            headers: { "Content-Type": "application/json" },
        }, "not-json");
        expect(result.status).toBe(400);
        await stopRegistry();
    });

    it("returns 404 for unmatched routes", async () => {
        startRegistry({ port: 18781 });
        const result = await httpRequest(18781, {
            method: "GET",
            path: "/unknown",
        });
        expect(result.status).toBe(404);
        await stopRegistry();
    });
});
