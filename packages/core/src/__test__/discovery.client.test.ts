import http from "http";

function startMockRegistry(port: number) {
    const instances: any[] = [];
    const heartbeats: any[] = [];
    const server = http.createServer((req, res) => {
        let body = "";
        req.on("data", (chunk) => { body += chunk; });
        req.on("end", () => {
            if (req.method === "POST" && req.url === "/register") {
                instances.push(JSON.parse(body));
                res.writeHead(200, { "Content-Type": "application/json" });
                res.end("{}");
            } else if (req.method === "POST" && req.url === "/deregister") {
                const { serviceId, host, port } = JSON.parse(body);
                const idx = instances.findIndex((i) => i.serviceId === serviceId && i.host === host && i.port === port);
                if (idx !== -1) instances.splice(idx, 1);
                res.writeHead(200, { "Content-Type": "application/json" });
                res.end("{}");
            } else if (req.method === "GET" && req.url?.startsWith("/discovery")) {
                const url = new URL(req.url!, `http://localhost:${port}`);
                const serviceId = url.searchParams.get("serviceId");
                const filtered = instances.filter((i) => i.serviceId === serviceId);
                res.writeHead(200, { "Content-Type": "application/json" });
                res.end(JSON.stringify(filtered));
            } else if (req.method === "POST" && req.url === "/heartbeat") {
                heartbeats.push(JSON.parse(body));
                res.writeHead(200, { "Content-Type": "application/json" });
                res.end("{}");
            } else {
                res.writeHead(404);
                res.end();
            }
        });
    });
    return new Promise<{ server: http.Server; instances: any[]; heartbeats: any[] }>((resolve) => {
        server.listen(port, () => resolve({ server, instances, heartbeats }));
    });
}

describe("DiscoveryClient network methods", () => {
    let DiscoveryClient: any;
    let mockServer: http.Server;
    let instances: any[];
    let heartbeats: any[];
    const PORT = 18799;

    beforeAll(async () => {
        DiscoveryClient = (await import("../discovery/index")).DiscoveryClient;
        const registry = await startMockRegistry(PORT);
        mockServer = registry.server;
        instances = registry.instances;
        heartbeats = registry.heartbeats;
    });

    afterAll(async () => {
        await new Promise<void>((resolve) => mockServer.close(() => resolve()));
    });

    beforeEach(() => {
        instances.length = 0;
        heartbeats.length = 0;
    });

    it("register sends instance to registry", async () => {
        const client = new DiscoveryClient(`http://127.0.0.1:${PORT}`);
        await client.register({ serviceId: "svc-a", host: "127.0.0.1", port: 3000, status: "UP", metadata: {}, registeredAt: Date.now(), lastHeartbeat: Date.now() });
        expect(instances).toHaveLength(1);
        expect(instances[0].serviceId).toBe("svc-a");
    });

    it("deregister removes instance from registry", async () => {
        const client = new DiscoveryClient(`http://127.0.0.1:${PORT}`);
        await client.register({ serviceId: "svc-b", host: "127.0.0.1", port: 4000, status: "UP", metadata: {}, registeredAt: Date.now(), lastHeartbeat: Date.now() });
        expect(instances).toHaveLength(1);
        await client.deregister("svc-b", "127.0.0.1", 4000);
        expect(instances).toHaveLength(0);
    });

    it("discover returns matching instances", async () => {
        const client = new DiscoveryClient(`http://127.0.0.1:${PORT}`);
        await client.register({ serviceId: "svc-c", host: "127.0.0.1", port: 5000, status: "UP", metadata: {}, registeredAt: Date.now(), lastHeartbeat: Date.now() });
        await client.register({ serviceId: "svc-c", host: "127.0.0.1", port: 5001, status: "UP", metadata: {}, registeredAt: Date.now(), lastHeartbeat: Date.now() });
        await client.register({ serviceId: "svc-d", host: "127.0.0.1", port: 6000, status: "UP", metadata: {}, registeredAt: Date.now(), lastHeartbeat: Date.now() });

        const found = await client.discover("svc-c");
        expect(found).toHaveLength(2);
        expect(found.every((i: any) => i.serviceId === "svc-c")).toBe(true);
    });

    it("discover returns empty array when no instances", async () => {
        const client = new DiscoveryClient(`http://127.0.0.1:${PORT}`);
        const found = await client.discover("nonexistent");
        expect(found).toEqual([]);
    });

    it("discoverOne returns a single instance or null", async () => {
        const client = new DiscoveryClient(`http://127.0.0.1:${PORT}`);
        const none = await client.discoverOne("no-svc");
        expect(none).toBeNull();

        await client.register({ serviceId: "single", host: "127.0.0.1", port: 7000, status: "UP", metadata: {}, registeredAt: Date.now(), lastHeartbeat: Date.now() });
        const one = await client.discoverOne("single");
        expect(one).toBeDefined();
        expect(one!.serviceId).toBe("single");
    });

    it("startHeartbeat sends periodic heartbeats", async () => {
        const client = new DiscoveryClient(`http://127.0.0.1:${PORT}`);
        const instance = { serviceId: "hb-svc", host: "127.0.0.1", port: 8000, status: "UP" as const, metadata: {}, registeredAt: Date.now(), lastHeartbeat: Date.now() };
        client.startHeartbeat(instance, 100);

        await new Promise((r) => setTimeout(r, 350));
        client.stopHeartbeat();

        expect(heartbeats.length).toBeGreaterThanOrEqual(2);
        expect(heartbeats[0].serviceId).toBe("hb-svc");
    });
});
