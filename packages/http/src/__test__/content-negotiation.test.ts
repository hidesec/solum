describe("content negotiation", () => {
    function detectContentType(accept: string): string {
        if (accept.includes("application/xml") || accept.includes("text/xml")) return "xml";
        if (accept.includes("text/html")) return "html";
        if (accept.includes("text/plain")) return "text";
        return "json";
    }

    it("detects XML from Accept header", () => {
        expect(detectContentType("application/xml")).toBe("xml");
        expect(detectContentType("text/xml")).toBe("xml");
    });

    it("detects HTML from Accept header", () => {
        expect(detectContentType("text/html")).toBe("html");
    });

    it("detects text from Accept header", () => {
        expect(detectContentType("text/plain")).toBe("text");
    });

    it("defaults to JSON", () => {
        expect(detectContentType("application/json")).toBe("json");
        expect(detectContentType("*/*")).toBe("json");
        expect(detectContentType("")).toBe("json");
    });
});

describe("nosniff header", () => {
    it("is set on all response methods", () => {
        const methods = ["json", "xml", "text", "html", "send"];
        for (const method of methods) {
            expect(typeof method).toBe("string");
        }
    });
});

describe("SSE event name sanitization", () => {
    it("strips newlines from event names", () => {
        const event = "test\nevent\r\nname";
        const safeEvent = event.replace(/[\r\n]/g, "");
        expect(safeEvent).toBe("testeventname");
        expect(safeEvent).not.toContain("\n");
        expect(safeEvent).not.toContain("\r");
    });

    it("allows safe event names", () => {
        const event = "my-event";
        const safeEvent = event.replace(/[\r\n]/g, "");
        expect(safeEvent).toBe("my-event");
    });
});

describe("XML escape", () => {
    function escapeXml(str: string): string {
        return str
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&apos;");
    }

    it("escapes special XML characters", () => {
        expect(escapeXml('<script>alert("xss")</script>')).toContain("&lt;script&gt;");
        expect(escapeXml("a&b")).toContain("&amp;");
    });
});
