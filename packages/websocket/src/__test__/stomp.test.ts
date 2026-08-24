import { parseStompFrame, serializeStompFrame } from "../index";

describe("parseStompFrame", () => {
    it("should parse a valid STOMP frame", () => {
        const raw = "CONNECT\r\naccept-version:1.2\r\nheart-beat:10000,10000\r\n\r\n\u0000";
        const frame = parseStompFrame(raw);
        expect(frame).not.toBeNull();
        expect(frame!.command).toBe("CONNECT");
        expect(frame!.headers["accept-version"]).toBe("1.2");
        expect(frame!.headers["heart-beat"]).toBe("10000,10000");
        expect(frame!.body).toBe("");
    });

    it("should parse frame with body", () => {
        const raw = "SEND\r\ndestination:/queue/test\r\n\r\nhello world\u0000";
        const frame = parseStompFrame(raw);
        expect(frame).not.toBeNull();
        expect(frame!.command).toBe("SEND");
        expect(frame!.headers["destination"]).toBe("/queue/test");
        expect(frame!.body).toBe("hello world");
    });

    it("should parse frame with colon in header value", () => {
        const raw = "CONNECT\r\nlogin:user:pass\r\n\r\n\u0000";
        const frame = parseStompFrame(raw);
        expect(frame).not.toBeNull();
        expect(frame!.headers["login"]).toBe("user:pass");
    });

    it("should return null for empty input", () => {
        expect(parseStompFrame("")).toBeNull();
    });

    it("should return null for oversized frame", () => {
        const largeBody = "x".repeat(256 * 1024 + 1);
        expect(parseStompFrame(largeBody)).toBeNull();
    });

    it("should return null for frame without command", () => {
        expect(parseStompFrame("\r\n\r\n\u0000")).toBeNull();
    });

    it("should parse frame without body separator", () => {
        const raw = "DISCONNECT\r\n\r\n";
        const frame = parseStompFrame(raw);
        expect(frame).not.toBeNull();
        expect(frame!.command).toBe("DISCONNECT");
        expect(frame!.body).toBe("");
    });
});

describe("serializeStompFrame", () => {
    it("should serialize a STOMP frame", () => {
        const result = serializeStompFrame("CONNECTED", { version: "1.2" }, "");
        expect(result).toContain("CONNECTED\r\n");
        expect(result).toContain("version:1.2\r\n");
        expect(result).toContain("\u0000");
    });

    it("should serialize frame with body", () => {
        const result = serializeStompFrame("MESSAGE", { destination: "/queue/test" }, "hello");
        expect(result).toContain("MESSAGE\r\n");
        expect(result).toContain("hello");
        expect(result.endsWith("\u0000")).toBe(true);
    });

    it("should round-trip with parseStompFrame", () => {
        const original = serializeStompFrame("SEND", { destination: "/topic/chat" }, "test message");
        const parsed = parseStompFrame(original);
        expect(parsed).not.toBeNull();
        expect(parsed!.command).toBe("SEND");
        expect(parsed!.headers["destination"]).toBe("/topic/chat");
        expect(parsed!.body).toBe("test message");
    });

    it("should handle empty headers", () => {
        const result = serializeStompFrame("DISCONNECT", {}, "");
        expect(result).toContain("DISCONNECT\r\n\r\n\u0000");
    });
});
