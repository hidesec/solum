import {
    startTrace,
    endSpan,
    addEvent,
    setAttribute,
    getTraceId,
    getSpanId,
    getTraceContext,
    getCurrentSpans,
    getTraceHeaders,
    trace,
    createTraceparent,
    parseTraceparent,
    extractW3CContext,
    injectW3CContext,
    ConsoleExporter,
    InMemoryExporter,
    createTraceMiddleware,
    createW3CTraceMiddleware,
} from "../tracing";

describe("tracing", () => {
    it("creates a trace with random IDs", () => {
        const span = startTrace("test-span");
        expect(span.traceId).toMatch(/^[0-9a-f]{32}$/);
        expect(span.spanId).toMatch(/^[0-9a-f]{16}$/);
        expect(span.name).toBe("test-span");
        expect(span.status).toBe("OK");
        endSpan(span);
    });

    it("sets attributes on span", () => {
        const span = startTrace("test");
        span.attributes["key"] = "value";
        expect(span.attributes["key"]).toBe("value");
        endSpan(span);
    });

    it("marks span as ERROR on failure", () => {
        const span = startTrace("test");
        endSpan(span, new Error("fail"));
        expect(span.status).toBe("ERROR");
        expect(span.attributes["error.message"]).toBe("fail");
    });

    it("getTraceId returns current trace ID", () => {
        const span = startTrace("test");
        expect(getTraceId()).toBe(span.traceId);
        endSpan(span);
    });

    it("getSpanId returns current span ID", () => {
        const span = startTrace("test");
        expect(getSpanId()).toBe(span.spanId);
        endSpan(span);
    });

    it("getTraceHeaders returns trace and span IDs", () => {
        const span = startTrace("test");
        const headers = getTraceHeaders();
        expect(headers["x-trace-id"]).toBe(span.traceId);
        expect(headers["x-span-id"]).toBe(span.spanId);
        endSpan(span);
    });

    it("trace() wraps async function with span", async () => {
        const result = await trace("op", async () => 42);
        expect(result).toBe(42);
    });

    it("trace() catches errors", async () => {
        await expect(trace("op", async () => { throw new Error("boom"); })).rejects.toThrow("boom");
    });
});

describe("addEvent", () => {
    it("adds event to current span", () => {
        const span = startTrace("test");
        addEvent("click", { target: "button" });
        expect(span.events).toHaveLength(1);
        expect(span.events[0].name).toBe("click");
        expect(span.events[0].attributes).toEqual({ target: "button" });
        endSpan(span);
    });

    it("does nothing when no active trace", () => {
        expect(() => addEvent("orphan")).not.toThrow();
    });

    it("adds event to most recent nested span", () => {
        const parent = startTrace("parent");
        const child = startTrace("child");
        addEvent("child-event");
        expect(child.events).toHaveLength(1);
        expect(parent.events).toHaveLength(0);
        endSpan(child);
        endSpan(parent);
    });
});

describe("setAttribute", () => {
    it("sets attribute on current span", () => {
        const span = startTrace("test");
        setAttribute("http.status", 200);
        expect(span.attributes["http.status"]).toBe(200);
        endSpan(span);
    });

    it("does nothing when no active trace", () => {
        expect(() => setAttribute("key", "value")).not.toThrow();
    });

    it("sets attribute on most recent nested span", () => {
        const parent = startTrace("parent");
        const child = startTrace("child");
        setAttribute("child-key", "child-val");
        expect(child.attributes["child-key"]).toBe("child-val");
        expect(parent.attributes["child-key"]).toBeUndefined();
        endSpan(child);
        endSpan(parent);
    });
});

describe("getTraceContext", () => {
    it("returns traceId and spanId when active", () => {
        const span = startTrace("test");
        const ctx = getTraceContext();
        expect(ctx).toBeDefined();
        expect(ctx!.traceId).toBe(span.traceId);
        expect(ctx!.spanId).toBe(span.spanId);
        endSpan(span);
    });

    it("returns undefined when no active trace", () => {
        expect(getTraceContext()).toBeUndefined();
    });
});

describe("getCurrentSpans", () => {
    it("returns empty array when no active trace", () => {
        expect(getCurrentSpans()).toEqual([]);
    });

    it("returns accumulated spans in nested trace", () => {
        const parent = startTrace("parent");
        const spans1 = getCurrentSpans();
        expect(spans1.length).toBeGreaterThanOrEqual(1);

        const child = startTrace("child");
        const spans2 = getCurrentSpans();
        expect(spans2.length).toBeGreaterThanOrEqual(2);

        endSpan(child);
        endSpan(parent);
    });
});

describe("ConsoleExporter", () => {
    it("exports spans without throwing", async () => {
        const exporter = new ConsoleExporter();
        const span = {
            traceId: "a".repeat(32),
            spanId: "b".repeat(16),
            name: "test",
            startTime: 1000,
            endTime: 2000,
            status: "OK" as const,
            attributes: {},
            events: [],
        };
        await expect(exporter.export([span])).resolves.toBeUndefined();
    });
});

describe("InMemoryExporter", () => {
    it("stores and retrieves spans", async () => {
        const exporter = new InMemoryExporter();
        const span = {
            traceId: "a".repeat(32),
            spanId: "b".repeat(16),
            name: "test",
            startTime: 1000,
            status: "OK" as const,
            attributes: {},
            events: [],
        };
        await exporter.export([span]);
        expect(exporter.getSpans()).toHaveLength(1);
        expect(exporter.getSpans()[0].name).toBe("test");
    });

    it("getSpans returns a copy", async () => {
        const exporter = new InMemoryExporter();
        const spans = exporter.getSpans();
        spans.push({} as any);
        expect(exporter.getSpans()).toHaveLength(0);
    });

    it("clear removes all spans", async () => {
        const exporter = new InMemoryExporter();
        await exporter.export([{ traceId: "a".repeat(32), spanId: "b".repeat(16), name: "x", startTime: 0, status: "OK", attributes: {}, events: [] }]);
        expect(exporter.getSpans()).toHaveLength(1);
        exporter.clear();
        expect(exporter.getSpans()).toHaveLength(0);
    });
});

describe("createTraceMiddleware", () => {
    it("creates middleware with getCollectedSpans and clearSpans", () => {
        const { middleware, getCollectedSpans, clearSpans } = createTraceMiddleware();
        expect(typeof middleware).toBe("function");
        expect(typeof getCollectedSpans).toBe("function");
        expect(typeof clearSpans).toBe("function");
    });

    it("middleware collects spans", () => {
        const { middleware, getCollectedSpans, clearSpans } = createTraceMiddleware();
        const req = { method: "GET", url: "/test", headers: {} };
        const res = {};
        let nextCalled = false;
        middleware(req, res, () => { nextCalled = true; });
        expect(nextCalled).toBe(true);
        expect(getCollectedSpans()).toHaveLength(1);
        clearSpans();
        expect(getCollectedSpans()).toHaveLength(0);
    });

    it("middleware uses incoming x-trace-id when valid hex", () => {
        const { middleware, getCollectedSpans } = createTraceMiddleware();
        const traceId = "a".repeat(32);
        middleware({ method: "GET", url: "/", headers: { "x-trace-id": traceId } }, {}, () => {});
        expect(getCollectedSpans()[0].traceId).toBe(traceId);
    });

    it("middleware generates new trace-id for invalid header", () => {
        const { middleware, getCollectedSpans } = createTraceMiddleware();
        middleware({ method: "GET", url: "/", headers: { "x-trace-id": "not-hex!" } }, {}, () => {});
        expect(getCollectedSpans()[0].traceId).toMatch(/^[0-9a-f]{32}$/);
    });
});

describe("createW3CTraceMiddleware", () => {
    it("creates middleware with defaults", () => {
        const m = createW3CTraceMiddleware();
        expect(typeof m.middleware).toBe("function");
        expect(typeof m.getCollectedSpans).toBe("function");
        expect(typeof m.clearSpans).toBe("function");
    });

    it("skips ignored paths", () => {
        const m = createW3CTraceMiddleware({ ignorePaths: ["/actuator"] });
        let nextCalled = false;
        m.middleware({ method: "GET", url: "/actuator/health", headers: {} }, {}, () => { nextCalled = true; });
        expect(nextCalled).toBe(true);
        expect(m.getCollectedSpans()).toHaveLength(0);
    });

    it("skips when sampleRate=0 (not sampled)", () => {
        const m = createW3CTraceMiddleware({ sampleRate: 0 });
        let nextCalled = false;
        m.middleware({ method: "GET", url: "/api", headers: {} }, {}, () => { nextCalled = true; });
        expect(nextCalled).toBe(true);
        expect(m.getCollectedSpans()).toHaveLength(0);
    });

    it("collects span when sampled (sampleRate=1)", () => {
        const m = createW3CTraceMiddleware({ sampleRate: 1 });
        const res = { setHeader: jest.fn() };
        m.middleware({ method: "GET", url: "/api", headers: {} }, res, () => {});
        expect(m.getCollectedSpans()).toHaveLength(1);
    });

    it("propagates correlation headers", () => {
        const m = createW3CTraceMiddleware({ propagateHeaders: ["x-request-id"] });
        const res = { setHeader: jest.fn() };
        m.middleware({ method: "GET", url: "/api", headers: { "x-request-id": "req-123" } }, res, () => {});
        expect(res.setHeader).toHaveBeenCalledWith("x-request-id", "req-123");
    });

    it("sanitizes dangerous correlation header values", () => {
        const m = createW3CTraceMiddleware({ propagateHeaders: ["x-request-id"] });
        const res = { setHeader: jest.fn() };
        m.middleware({ method: "GET", url: "/api", headers: { "x-request-id": "<script>alert(1)</script>" } }, res, () => {});
        expect(res.setHeader).not.toHaveBeenCalledWith("x-request-id", "<script>alert(1)</script>");
    });

    it("injects traceparent response header", () => {
        const m = createW3CTraceMiddleware();
        const res = { setHeader: jest.fn() };
        m.middleware({ method: "GET", url: "/api", headers: {} }, res, () => {});
        const traceparentCall = res.setHeader.mock.calls.find((c: any) => c[0] === "traceparent");
        expect(traceparentCall).toBeDefined();
        expect(traceparentCall![1]).toMatch(/^00-[0-9a-f]{32}-[0-9a-f]{16}-[0-9a-f]{2}$/);
    });

    it("extracts incoming W3C context", () => {
        const m = createW3CTraceMiddleware();
        const traceId = "a".repeat(32);
        const spanId = "b".repeat(16);
        const traceparent = `00-${traceId}-${spanId}-01`;
        const res = { setHeader: jest.fn() };
        m.middleware({ method: "GET", url: "/api", headers: { traceparent } }, res, () => {});
        expect(m.getCollectedSpans()[0].traceId).toBe(traceId);
    });
});
