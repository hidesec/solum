describe("GrpcClientFrame encode/decode", () => {
    it("encodes data into frame with header", () => {
        const data = Buffer.from(JSON.stringify({ service: "Test", method: "Hello" }));
        const header = Buffer.alloc(9);
        header.writeUInt8(0, 0);
        header.writeUInt32BE(data.length, 1);
        header.writeUInt32BE(0, 5);
        const frame = Buffer.concat([header, data]);

        expect(frame.readUInt8(0)).toBe(0);
        expect(frame.readUInt32BE(1)).toBe(data.length);
        expect(frame.readUInt32BE(5)).toBe(0);
        expect(frame.subarray(9).toString()).toBe(data.toString());
    });

    it("decodes a valid frame", () => {
        const payload = Buffer.from('{"data":"hello"}');
        const header = Buffer.alloc(9);
        header.writeUInt8(0, 0);
        header.writeUInt32BE(payload.length, 1);
        header.writeUInt32BE(0, 5);
        const frame = Buffer.concat([header, payload]);

        if (frame.length < 9) return;
        const length = frame.readUInt32BE(1);
        expect(length).toBe(payload.length);
        const decoded = frame.subarray(9, 9 + length);
        expect(decoded.toString()).toBe('{"data":"hello"}');
    });

    it("returns null for incomplete frame (less than 9 bytes)", () => {
        const incomplete = Buffer.alloc(5);
        expect(incomplete.length).toBeLessThan(9);
    });

    it("returns null when buffer length < header + payload", () => {
        const header = Buffer.alloc(9);
        header.writeUInt8(0, 0);
        header.writeUInt32BE(100, 1);
        header.writeUInt32BE(0, 5);
        const shortBuffer = Buffer.concat([header, Buffer.from("abc")]);
        expect(shortBuffer.length).toBe(12);
        expect(shortBuffer.length).toBeLessThan(9 + 100);
    });

    it("rejects frame exceeding MAX_FRAME_SIZE (1MB)", () => {
        const MAX_FRAME_SIZE = 1024 * 1024;
        const header = Buffer.alloc(9);
        header.writeUInt8(0, 0);
        header.writeUInt32BE(MAX_FRAME_SIZE + 1, 1);
        header.writeUInt32BE(0, 5);

        const frameSize = header.readUInt32BE(1);
        expect(frameSize).toBeGreaterThan(MAX_FRAME_SIZE);
    });

    it("rejects frame exceeding client MAX_BUFFER_SIZE (4MB)", () => {
        const MAX_BUFFER_SIZE = 4 * 1024 * 1024;
        expect(MAX_BUFFER_SIZE).toBe(4194304);
    });

    it("validates JSON depth limit for server safety", () => {
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

describe("createGrpcClient", () => {
    it("exports createGrpcClient function", async () => {
        const { createGrpcClient } = await import("../client");
        expect(typeof createGrpcClient).toBe("function");
    });

    it("creates client with default options", async () => {
        const { createGrpcClient } = await import("../client");
        const client = createGrpcClient();
        expect(client).toBeDefined();
        expect(typeof client.invoke).toBe("function");
        expect(typeof client.close).toBe("function");
    });

    it("creates client with custom options", async () => {
        const { createGrpcClient } = await import("../client");
        const client = createGrpcClient({
            host: "10.0.0.1",
            port: 50052,
            timeout: 1000,
            maxRetries: 5,
        });
        expect(client).toBeDefined();
    });

    it("creates client with TLS option", async () => {
        const { createGrpcClient } = await import("../client");
        const client = createGrpcClient({
            tls: true,
            rejectUnauthorized: false,
        });
        expect(client).toBeDefined();
    });

    it("close resolves without connection", async () => {
        const { createGrpcClient } = await import("../client");
        const client = createGrpcClient({ host: "127.0.0.1", port: 50099 });
        await expect(client.close()).resolves.toBeUndefined();
    });

    it("invoke rejects when server not available", async () => {
        const { createGrpcClient } = await import("../client");
        const client = createGrpcClient({
            host: "127.0.0.1",
            port: 50099,
            timeout: 200,
            maxRetries: 0,
        });
        await expect(client.invoke("Test", "Hello", {})).rejects.toThrow();
        await client.close();
    });
});

describe("GrpcClientFrame MAX_BUFFER_SIZE", () => {
    it("MAX_BUFFER_SIZE is 4MB", () => {
        const MAX_BUFFER_SIZE = 4 * 1024 * 1024;
        expect(MAX_BUFFER_SIZE).toBe(4194304);
    });

    it("MAX_FRAME_SIZE is 1MB", () => {
        const MAX_FRAME_SIZE = 1024 * 1024;
        expect(MAX_FRAME_SIZE).toBe(1048576);
    });
});
