import {
    createW3CTraceMiddleware,
    parseTraceparent,
    createTraceparent,
    extractW3CContext,
    injectW3CContext,
} from "../tracing";

describe("sanitizeHeaderValue (tested via createW3CTraceMiddleware)", () => {
    it("allows safe alphanumeric header values", () => {
        const m = createW3CTraceMiddleware({ propagateHeaders: ["x-request-id"] });
        const res = { setHeader: jest.fn() };
        m.middleware({ method: "GET", url: "/api", headers: { "x-request-id": "req-123" } }, res, () => {});
        expect(res.setHeader).toHaveBeenCalledWith("x-request-id", "req-123");
    });

    it("allows safe header value with dots, dashes, underscores", () => {
        const m = createW3CTraceMiddleware({ propagateHeaders: ["x-request-id"] });
        const res = { setHeader: jest.fn() };
        m.middleware({ method: "GET", url: "/api", headers: { "x-request-id": "abc-123_def.xyz" } }, res, () => {});
        expect(res.setHeader).toHaveBeenCalledWith("x-request-id", "abc-123_def.xyz");
    });

    it("rejects header value with angle brackets", () => {
        const m = createW3CTraceMiddleware({ propagateHeaders: ["x-request-id"] });
        const res = { setHeader: jest.fn() };
        m.middleware({ method: "GET", url: "/api", headers: { "x-request-id": "<script>alert(1)</script>" } }, res, () => {});
        const calls = res.setHeader.mock.calls.filter((c: any) => c[0] === "x-request-id");
        expect(calls).toHaveLength(0);
    });

    it("rejects header value with newlines", () => {
        const m = createW3CTraceMiddleware({ propagateHeaders: ["x-request-id"] });
        const res = { setHeader: jest.fn() };
        m.middleware({ method: "GET", url: "/api", headers: { "x-request-id": "line1\nline2" } }, res, () => {});
        const calls = res.setHeader.mock.calls.filter((c: any) => c[0] === "x-request-id");
        expect(calls).toHaveLength(0);
    });

    it("rejects header value with single quotes", () => {
        const m = createW3CTraceMiddleware({ propagateHeaders: ["x-request-id"] });
        const res = { setHeader: jest.fn() };
        m.middleware({ method: "GET", url: "/api", headers: { "x-request-id": "it's-injected" } }, res, () => {});
        const calls = res.setHeader.mock.calls.filter((c: any) => c[0] === "x-request-id");
        expect(calls).toHaveLength(0);
    });

    it("truncates header value over 256 characters", () => {
        const m = createW3CTraceMiddleware({ propagateHeaders: ["x-request-id"] });
        const res = { setHeader: jest.fn() };
        const longValue = "a".repeat(300);
        m.middleware({ method: "GET", url: "/api", headers: { "x-request-id": longValue } }, res, () => {});
        const call = res.setHeader.mock.calls.find((c: any) => c[0] === "x-request-id");
        if (call) {
            expect((call[1] as string).length).toBeLessThanOrEqual(256);
        }
    });

    it("rejects empty header value", () => {
        const m = createW3CTraceMiddleware({ propagateHeaders: ["x-request-id"] });
        const res = { setHeader: jest.fn() };
        m.middleware({ method: "GET", url: "/api", headers: { "x-request-id": "" } }, res, () => {});
        const calls = res.setHeader.mock.calls.filter((c: any) => c[0] === "x-request-id");
        expect(calls).toHaveLength(0);
    });

    it("does not propagate headers not in the list", () => {
        const m = createW3CTraceMiddleware({ propagateHeaders: ["x-request-id"] });
        const res = { setHeader: jest.fn() };
        m.middleware({ method: "GET", url: "/api", headers: { "x-custom-header": "value" } }, res, () => {});
        const calls = res.setHeader.mock.calls.filter((c: any) => c[0] === "x-custom-header");
        expect(calls).toHaveLength(0);
    });
});

describe("createW3CTraceMiddleware additional edge cases", () => {
    it("extracts tracestate from incoming W3C headers", () => {
        const m = createW3CTraceMiddleware();
        const traceId = "a".repeat(32);
        const spanId = "b".repeat(16);
        const res = { setHeader: jest.fn() };
        m.middleware({
            method: "GET",
            url: "/api",
            headers: {
                traceparent: `00-${traceId}-${spanId}-01`,
                tracestate: "vendor1=value1",
            },
        }, res, () => {});
        const spans = m.getCollectedSpans();
        expect(spans[0].traceState).toBe("vendor1=value1");
    });

    it("collects multiple spans for multiple requests", () => {
        const m = createW3CTraceMiddleware();
        const res = { setHeader: jest.fn() };
        m.middleware({ method: "GET", url: "/a", headers: {} }, res, () => {});
        m.middleware({ method: "POST", url: "/b", headers: {} }, res, () => {});
        expect(m.getCollectedSpans()).toHaveLength(2);
    });

    it("clearSpans resets collected spans", () => {
        const m = createW3CTraceMiddleware();
        const res = { setHeader: jest.fn() };
        m.middleware({ method: "GET", url: "/api", headers: {} }, res, () => {});
        expect(m.getCollectedSpans()).toHaveLength(1);
        m.clearSpans();
        expect(m.getCollectedSpans()).toHaveLength(0);
    });

    it("multiple propagateHeaders all forwarded", () => {
        const m = createW3CTraceMiddleware({
            propagateHeaders: ["x-request-id", "x-correlation-id", "x-trace-id"],
        });
        const res = { setHeader: jest.fn() };
        m.middleware({
            method: "GET",
            url: "/api",
            headers: {
                "x-request-id": "req-1",
                "x-correlation-id": "corr-2",
                "x-trace-id": "trace-3",
            },
        }, res, () => {});
        expect(res.setHeader).toHaveBeenCalledWith("x-request-id", "req-1");
        expect(res.setHeader).toHaveBeenCalledWith("x-correlation-id", "corr-2");
        expect(res.setHeader).toHaveBeenCalledWith("x-trace-id", "trace-3");
    });

    it("missing headers do not cause errors", () => {
        const m = createW3CTraceMiddleware({ propagateHeaders: ["x-request-id"] });
        const res = { setHeader: jest.fn() };
        expect(() => {
            m.middleware({ method: "GET", url: "/api", headers: {} }, res, () => {});
        }).not.toThrow();
    });

    it("default ignorePaths includes /actuator and /health", () => {
        const m = createW3CTraceMiddleware();
        let next1 = false, next2 = false;
        m.middleware({ method: "GET", url: "/actuator/info", headers: {} }, {}, () => { next1 = true; });
        m.middleware({ method: "GET", url: "/health", headers: {} }, {}, () => { next2 = true; });
        expect(next1).toBe(true);
        expect(next2).toBe(true);
        expect(m.getCollectedSpans()).toHaveLength(0);
    });
});

describe("parseTraceparent edge cases", () => {
    it("returns null for empty string", () => {
        expect(parseTraceparent("")).toBeNull();
    });

    it("returns null for invalid format", () => {
        expect(parseTraceparent("invalid")).toBeNull();
    });

    it("returns null for wrong version", () => {
        expect(parseTraceparent("01-aabbccdd-aabbccdd-aabbccdd-aabbccdd-01")).toBeNull();
    });

    it("returns null for short traceId", () => {
        expect(parseTraceparent("00-aabbccdd-aabbccdd-01")).toBeNull();
    });

    it("returns valid context for correct format", () => {
        const result = parseTraceparent("00-aabbccddaabbccddaabbccddaabbccdd-aabbccddaabbccdd-01");
        expect(result).not.toBeNull();
        expect(result!.traceparent).toContain("00-");
    });

    it("handles traceparent with trace-id (32 hex chars)", () => {
        const traceId = "a".repeat(32);
        const spanId = "b".repeat(16);
        const result = parseTraceparent(`00-${traceId}-${spanId}-01`);
        expect(result).not.toBeNull();
    });
});

describe("createTraceparent edge cases", () => {
    it("creates valid traceparent with default flags", () => {
        const result = createTraceparent("a".repeat(32), "b".repeat(16));
        expect(result).toBe("00-" + "a".repeat(32) + "-" + "b".repeat(16) + "-01");
    });

    it("creates traceparent with custom flags", () => {
        const result = createTraceparent("a".repeat(32), "b".repeat(16), 0);
        expect(result).toBe("00-" + "a".repeat(32) + "-" + "b".repeat(16) + "-00");
    });

    it("pads single-digit hex flags", () => {
        const result = createTraceparent("a".repeat(32), "b".repeat(16), 15);
        expect(result).toContain("-0f");
    });
});

describe("extractW3CContext edge cases", () => {
    it("returns null when no traceparent header", () => {
        expect(extractW3CContext({})).toBeNull();
    });

    it("returns null when traceparent is not a string", () => {
        expect(extractW3CContext({ traceparent: ["array"] })).toBeNull();
    });

    it("returns null for malformed traceparent", () => {
        expect(extractW3CContext({ traceparent: "bad" })).toBeNull();
    });

    it("extracts tracestate when present", () => {
        const traceId = "a".repeat(32);
        const spanId = "b".repeat(16);
        const result = extractW3CContext({
            traceparent: `00-${traceId}-${spanId}-01`,
            tracestate: "vendor=value",
        });
        expect(result).not.toBeNull();
        expect(result!.tracestate).toBe("vendor=value");
    });

    it("tracestate is undefined when not present", () => {
        const traceId = "a".repeat(32);
        const spanId = "b".repeat(16);
        const result = extractW3CContext({
            traceparent: `00-${traceId}-${spanId}-01`,
        });
        expect(result).not.toBeNull();
        expect(result!.tracestate).toBeUndefined();
    });
});
