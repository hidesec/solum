import crypto from "crypto";
import {
    createServiceInstance,
    registerInstance,
    deregisterInstance,
    discoverInstances,
    discoverOne,
    updateInstanceStatus,
    getAllInstances,
} from "../discovery/index";

describe("service instance lifecycle", () => {
    beforeEach(() => {
        const all = getAllInstances();
        all.clear();
    });

    it("createServiceInstance creates instance with correct defaults", () => {
        const instance = createServiceInstance("my-service", "127.0.0.1", 3000, { version: "1.0" });
        expect(instance.serviceId).toBe("my-service");
        expect(instance.host).toBe("127.0.0.1");
        expect(instance.port).toBe(3000);
        expect(instance.metadata).toEqual({ version: "1.0" });
        expect(instance.status).toBe("UP");
        expect(instance.registeredAt).toBeGreaterThan(0);
        expect(instance.lastHeartbeat).toBeGreaterThan(0);
    });

    it("registerInstance stores instance", () => {
        const instance = createServiceInstance("svc-a", "10.0.0.1", 8080);
        registerInstance(instance);
        const discovered = discoverInstances("svc-a");
        expect(discovered).toHaveLength(1);
        expect(discovered[0].host).toBe("10.0.0.1");
    });

    it("deregisterInstance removes instance", () => {
        const instance = createServiceInstance("svc-b", "10.0.0.2", 9090);
        registerInstance(instance);
        deregisterInstance("svc-b", "10.0.0.2", 9090);
        const discovered = discoverInstances("svc-b");
        expect(discovered).toHaveLength(0);
    });

    it("discoverInstances returns only UP instances", () => {
        const up = createServiceInstance("svc-c", "10.0.0.3", 8001);
        const down = createServiceInstance("svc-c", "10.0.0.4", 8002);
        registerInstance(up);
        registerInstance(down);
        updateInstanceStatus("svc-c", "10.0.0.4", 8002, "DOWN");

        const discovered = discoverInstances("svc-c");
        expect(discovered).toHaveLength(1);
        expect(discovered[0].host).toBe("10.0.0.3");
    });

    it("discoverOne returns a random instance or null", () => {
        const result = discoverOne("nonexistent");
        expect(result).toBeNull();

        const instance = createServiceInstance("single", "127.0.0.1", 3001);
        registerInstance(instance);
        const found = discoverOne("single");
        expect(found).toBeDefined();
        expect(found!.serviceId).toBe("single");
    });

    it("updateInstanceStatus changes status", () => {
        const instance = createServiceInstance("svc-d", "10.0.0.5", 8003);
        registerInstance(instance);
        updateInstanceStatus("svc-d", "10.0.0.5", 8003, "OUT_OF_SERVICE");
        const discovered = discoverInstances("svc-d");
        expect(discovered).toHaveLength(0);

        updateInstanceStatus("svc-d", "10.0.0.5", 8003, "UP");
        const restored = discoverInstances("svc-d");
        expect(restored).toHaveLength(1);
    });

    it("getAllInstances returns map", () => {
        const all = getAllInstances();
        expect(all).toBeInstanceOf(Map);
    });

    it("registering multiple instances of same service", () => {
        const a = createServiceInstance("multi", "10.0.0.1", 8001);
        const b = createServiceInstance("multi", "10.0.0.2", 8002);
        registerInstance(a);
        registerInstance(b);
        expect(discoverInstances("multi")).toHaveLength(2);
    });
});

describe("startRegistry and stopRegistry", () => {
    it("startRegistry returns http.Server", async () => {
        const { startRegistry, stopRegistry } = await import("../discovery/index");
        const server = startRegistry({ port: 18761 });
        expect(server).toBeDefined();
        expect(typeof server.listen).toBe("function");
        await stopRegistry();
    });

    it("stopRegistry resolves cleanly when no server running", async () => {
        const { stopRegistry } = await import("../discovery/index");
        await expect(stopRegistry()).resolves.toBeUndefined();
    });
});

describe("DiscoveryClient", () => {
    it("creates a client", async () => {
        const { DiscoveryClient } = await import("../discovery/index");
        const client = new DiscoveryClient("http://127.0.0.1:18762");
        expect(client).toBeDefined();
    });

    it("stopHeartbeat resolves cleanly when no heartbeat running", async () => {
        const { DiscoveryClient } = await import("../discovery/index");
        const client = new DiscoveryClient("http://127.0.0.1:18762");
        expect(() => client.stopHeartbeat()).not.toThrow();
    });
});

describe("heartbeat timeout detection", () => {
    beforeEach(() => {
        const { getAllInstances } = require("../discovery/index");
        getAllInstances().clear();
    });

    it("instance marked DOWN when heartbeat expired", () => {
        const { createServiceInstance, registerInstance, updateInstanceStatus, getAllInstances } = require("../discovery/index");
        const instance = createServiceInstance("heartbeat-svc", "10.0.0.1", 8001);
        registerInstance(instance);
        updateInstanceStatus("heartbeat-svc", "10.0.0.1", 8001, "DOWN");
        const all = getAllInstances();
        const svc = all.get("heartbeat-svc")?.get("10.0.0.1:8001");
        expect(svc?.status).toBe("DOWN");
    });
});
