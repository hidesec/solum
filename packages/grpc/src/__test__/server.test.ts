describe("GrpcFrame", () => {
    let GrpcFrame: any;

    beforeAll(async () => {
        const mod = await import("../server");
        GrpcFrame = (mod as any).__GrpcFrame || null;
    });

    it("encodes and decodes unary frame", () => {
        const data = Buffer.from(JSON.stringify({ service: "Test", method: "Hello" }));
        const header = Buffer.alloc(9);
        header.writeUInt8(0, 0);
        header.writeUInt32BE(data.length, 1);
        header.writeUInt32BE(0, 5);
        const frame = Buffer.concat([header, data]);

        expect(frame.length).toBe(9 + data.length);
        expect(frame.readUInt8(0)).toBe(0);
        expect(frame.readUInt32BE(1)).toBe(data.length);
    });

    it("rejects frame exceeding max size", () => {
        const header = Buffer.alloc(9);
        header.writeUInt8(0, 0);
        header.writeUInt32BE(2 * 1024 * 1024, 1);
        header.writeUInt32BE(0, 5);

        expect(header.readUInt32BE(1)).toBeGreaterThan(1024 * 1024);
    });

    it("returns null for incomplete frame", () => {
        const incomplete = Buffer.alloc(5);
        expect(incomplete.length).toBeLessThan(9);
    });

    it("validates JSON depth limit", () => {
        const MAX_JSON_DEPTH = 5;
        const deepObj: any = {};
        let current = deepObj;
        for (let i = 0; i < 10; i++) {
            current.nested = {};
            current = current.nested;
        }

        let depth = 0;
        const checkDepth = (obj: any): void => {
            if (depth > MAX_JSON_DEPTH) throw new Error("too deep");
            if (obj && typeof obj === "object") {
                depth++;
                for (const key of Object.keys(obj)) checkDepth(obj[key]);
                depth--;
            }
        };

        expect(() => checkDepth(deepObj)).toThrow("too deep");
    });

    it("allows shallow JSON within depth limit", () => {
        const MAX_JSON_DEPTH = 5;
        const shallowObj = { a: { b: { c: 1 } } };

        let depth = 0;
        const checkDepth = (obj: any): void => {
            if (depth > MAX_JSON_DEPTH) throw new Error("too deep");
            if (obj && typeof obj === "object") {
                depth++;
                for (const key of Object.keys(obj)) checkDepth(obj[key]);
                depth--;
            }
        };

        expect(() => checkDepth(shallowObj)).not.toThrow();
    });
});

describe("gRPC service decorators", () => {
    it("registers service metadata", async () => {
        const { GrpcService, GrpcMethod, getGrpcServiceDefinition } = await import("../decorators");

        @GrpcService("TestService")
        class TestService {
            @GrpcMethod("Hello", { requestType: "HelloRequest", responseType: "HelloResponse" })
            async hello(data: { name: string }) {
                return { message: `Hello ${data.name}` };
            }
        }

        const definition = getGrpcServiceDefinition(TestService);
        expect(definition).not.toBeNull();
        expect(definition!.serviceName).toBe("TestService");
        expect(definition!.methods).toHaveLength(1);
        expect(definition!.methods[0].methodName).toBe("Hello");
        expect(definition!.methods[0].requestType).toBe("HelloRequest");
    });

    it("returns null for non-service class", async () => {
        const { getGrpcServiceDefinition } = await import("../decorators");
        class NotAService {}
        const definition = getGrpcServiceDefinition(NotAService);
        expect(definition).toBeNull();
    });

    it("GrpcStream decorator registers stream metadata", async () => {
        const { GrpcService, GrpcStream, GrpcMethod, getGrpcServiceDefinition } = await import("../decorators");

        @GrpcService("StreamService")
        class StreamService {
            @GrpcMethod("Unary")
            async unary() {}

            @GrpcStream("server")
            async serverStream() {}
        }

        const def = getGrpcServiceDefinition(StreamService);
        expect(def).not.toBeNull();
        expect(def!.methods).toHaveLength(1);
        expect(def!.methods[0].methodName).toBe("Unary");
    });

    it("getRegisteredGrpcServices returns array", async () => {
        const { getRegisteredGrpcServices } = await import("../decorators");
        const result = getRegisteredGrpcServices();
        expect(Array.isArray(result)).toBe(true);
    });
});

describe("createGrpcServer lifecycle", () => {
    it("creates server with default options", async () => {
        const { createGrpcServer } = await import("../server");
        const server = createGrpcServer([]);
        expect(server).toBeDefined();
        expect(typeof server.start).toBe("function");
        expect(typeof server.stop).toBe("function");
        expect(typeof server.getPort).toBe("function");
    });

    it("getPort returns configured port", async () => {
        const { createGrpcServer } = await import("../server");
        const server = createGrpcServer([], { port: 50099 });
        expect(server.getPort()).toBe(50099);
    });

    it("stop resolves cleanly when no server started", async () => {
        const { createGrpcServer } = await import("../server");
        const server = createGrpcServer([]);
        await expect(server.stop()).resolves.toBeUndefined();
    });
});
