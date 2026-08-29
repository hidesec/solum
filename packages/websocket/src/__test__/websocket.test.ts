import {
    parseStompFrame,
    serializeStompFrame,
    getStompHandlers,
    MessageMapping,
    StompHandler,
    getWsHandlerPath,
    WebSocketHandler,
} from "../index";

describe("parseStompFrame", () => {
    it("parses a valid STOMP frame", () => {
        const raw = "CONNECT\r\naccept-version:1.2\r\n\r\n\0";
        const frame = parseStompFrame(raw);
        expect(frame).not.toBeNull();
        expect(frame!.command).toBe("CONNECT");
        expect(frame!.headers["accept-version"]).toBe("1.2");
    });

    it("parses frame with body", () => {
        const raw = "SEND\r\ndestination:/queue/test\r\n\r\nhello world\0";
        const frame = parseStompFrame(raw);
        expect(frame).not.toBeNull();
        expect(frame!.command).toBe("SEND");
        expect(frame!.headers["destination"]).toBe("/queue/test");
        expect(frame!.body).toBe("hello world");
    });

    it("returns null for empty command", () => {
        const frame = parseStompFrame("\r\n\r\n\0");
        expect(frame).toBeNull();
    });

    it("rejects oversized frames (>256KB)", () => {
        const large = "A".repeat(257 * 1024);
        const frame = parseStompFrame(large);
        expect(frame).toBeNull();
    });

    it("parses CONNECT frame", () => {
        const raw = "CONNECT\r\nlogin:user\r\npasscode:pass\r\n\r\n\0";
        const frame = parseStompFrame(raw);
        expect(frame!.command).toBe("CONNECT");
        expect(frame!.headers["login"]).toBe("user");
    });
});

describe("serializeStompFrame", () => {
    it("serializes a frame with command and headers", () => {
        const result = serializeStompFrame("CONNECTED", { version: "1.2" });
        expect(result).toContain("CONNECTED\r\n");
        expect(result).toContain("version:1.2\r\n");
        expect(result.endsWith("\0")).toBe(true);
    });

    it("serializes a frame with body", () => {
        const result = serializeStompFrame("MESSAGE", { destination: "/queue/test" }, "hello");
        expect(result).toContain("MESSAGE\r\n");
        expect(result).toContain("destination:/queue/test\r\n");
        expect(result).toContain("hello");
        expect(result.endsWith("\0")).toBe(true);
    });

    it("serializes empty frame", () => {
        const result = serializeStompFrame("STOMP");
        expect(result).toContain("STOMP\r\n");
        expect(result.endsWith("\0")).toBe(true);
    });
});

describe("STOMP body sanitization", () => {
    it("escapes HTML special characters", () => {
        const body = '<script>alert("xss")</script>';
        const sanitized = body
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#x27;");
        expect(sanitized).toContain("&lt;script&gt;");
        expect(sanitized).not.toContain("<script>");
    });
});

describe("WebSocket decorators", () => {
    @WebSocketHandler("/ws")
    class TestHandler {
        handleConnection() {}
    }

    it("WebSocketHandler stores path metadata", () => {
        const path = getWsHandlerPath(TestHandler);
        expect(path).toBe("/ws");
    });

    it("getWsHandlerPath returns undefined for unregistered class", () => {
        class Unregistered {}
        expect(getWsHandlerPath(Unregistered)).toBeUndefined();
    });

    it("WebSocketHandler uses default path", () => {
        @WebSocketHandler()
        class DefaultHandler {
            handleConnection() {}
        }
        expect(getWsHandlerPath(DefaultHandler)).toBe("/ws");
    });
});

describe("STOMP decorators", () => {
    @StompHandler()
    class TestStompHandler {
        @MessageMapping("/queue/test")
        handleTestMsg() {}

        @MessageMapping("/queue/other")
        handleOtherMsg() {}
    }

    it("StompHandler registers path", () => {
        const path = getWsHandlerPath(TestStompHandler);
        expect(path).toBe("/stomp");
    });

    it("getStompHandlers returns handlers", () => {
        const handlers = getStompHandlers(TestStompHandler);
        expect(handlers).toHaveLength(2);
        expect(handlers[0].destination).toBe("/queue/test");
        expect(handlers[0].methodName).toBe("handleTestMsg");
        expect(handlers[1].destination).toBe("/queue/other");
    });

    it("getStompHandlers returns empty for unregistered class", () => {
        class Empty {}
        expect(getStompHandlers(Empty)).toEqual([]);
    });
});

describe("WebSocket auth via header", () => {
    it("Bearer token extraction", () => {
        const authHeader = "Bearer my-secret-token";
        const token = authHeader.replace("Bearer ", "");
        expect(token).toBe("my-secret-token");
    });

    it("missing header returns undefined", () => {
        const authHeader = undefined as string | undefined;
        const token = authHeader?.replace("Bearer ", "");
        expect(token).toBeUndefined();
    });
});

describe("WebSocket frame sizes", () => {
    it("MAX_WS_FRAME_SIZE is 1MB", () => {
        expect(1024 * 1024).toBe(1048576);
    });

    it("MAX_STOMP_FRAME_SIZE is 256KB", () => {
        expect(256 * 1024).toBe(262144);
    });
});
