import { prometheusMetrics, createHttpMetricsMiddleware } from "../actuator";

describe("prometheusMetrics", () => {
    beforeEach(() => {
        prometheusMetrics["counters"]?.clear?.();
        prometheusMetrics["gauges"]?.clear?.();
        prometheusMetrics["histograms"]?.clear?.();
    });

    it("increments counter", () => {
        prometheusMetrics.incCounter("test_counter");
        prometheusMetrics.incCounter("test_counter");
        const output = prometheusMetrics.format();
        expect(output).toContain("test_counter");
    });

    it("increments counter by custom value", () => {
        prometheusMetrics.incCounter("custom_counter", 5);
        const output = prometheusMetrics.format();
        expect(output).toContain("custom_counter 5");
    });

    it("sets gauge", () => {
        prometheusMetrics.setGauge("test_gauge", 42);
        const output = prometheusMetrics.format();
        expect(output).toContain("test_gauge 42");
    });

    it("gauge overwrite replaces previous value", () => {
        prometheusMetrics.setGauge("gauge_ow", 10);
        prometheusMetrics.setGauge("gauge_ow", 20);
        const output = prometheusMetrics.format();
        expect(output).toContain("gauge_ow 20");
        expect(output).not.toContain("gauge_ow 10\n");
    });

    it("observes histogram", () => {
        prometheusMetrics.observeHistogram("test_histogram", 10);
        prometheusMetrics.observeHistogram("test_histogram", 50);
        const output = prometheusMetrics.format();
        expect(output).toContain("test_histogram");
        expect(output).toContain("test_histogram_bucket");
        expect(output).toContain("test_histogram_count 2");
    });

    it("histogram computes sum correctly", () => {
        prometheusMetrics.observeHistogram("hist_sum", 3);
        prometheusMetrics.observeHistogram("hist_sum", 7);
        const output = prometheusMetrics.format();
        expect(output).toContain("hist_sum_sum 10");
    });

    it("histogram computes bucket counts", () => {
        prometheusMetrics.observeHistogram("hist_bucket", 2);
        prometheusMetrics.observeHistogram("hist_bucket", 8);
        prometheusMetrics.observeHistogram("hist_bucket", 15);
        const output = prometheusMetrics.format();
        expect(output).toContain('hist_bucket_bucket{le="5"} 1');
        expect(output).toContain('hist_bucket_bucket{le="10"} 2');
        expect(output).toContain('hist_bucket_bucket{le="25"} 3');
        expect(output).toContain('hist_bucket_bucket{le="+Inf"} 3');
    });

    it("formats output in Prometheus text format", () => {
        prometheusMetrics.incCounter("http_requests_total");
        prometheusMetrics.setGauge("memory_bytes", 1024);
        const output = prometheusMetrics.format();
        expect(output).toContain("# HELP");
        expect(output).toContain("# TYPE");
        expect(output).toContain("counter");
        expect(output).toContain("gauge");
    });

    it("format returns string ending with newline", () => {
        prometheusMetrics.incCounter("fmt_test");
        expect(prometheusMetrics.format()).toMatch(/\n$/);
    });
});

describe("createHttpMetricsMiddleware", () => {
    it("returns a middleware function", () => {
        const middleware = createHttpMetricsMiddleware();
        expect(typeof middleware).toBe("function");
    });

    it("calls next", () => {
        const middleware = createHttpMetricsMiddleware();
        let nextCalled = false;
        const req = { method: "GET", path: "/test" } as any;
        const res = {
            raw: {
                statusCode: 200,
                end: jest.fn(),
            },
        } as any;
        middleware(req, res, () => { nextCalled = true; });
        expect(nextCalled).toBe(true);
    });

    it("tracks request metrics on response end", () => {
        const middleware = createHttpMetricsMiddleware();
        const endFn = jest.fn();
        const req = { method: "POST", path: "/users/123" } as any;
        const res = {
            raw: {
                statusCode: 201,
                end: endFn,
            },
        } as any;
        middleware(req, res, () => {});
        res.raw.end();
        expect(endFn).toHaveBeenCalled();
    });

    it("normalizes numeric path segments to :id", () => {
        const middleware = createHttpMetricsMiddleware();
        const req = { method: "GET", path: "/users/42" } as any;
        const res = { raw: { statusCode: 200, end: jest.fn() } } as any;
        middleware(req, res, () => {});
        res.raw.end();
    });

    it("normalizes UUID path segments", () => {
        const middleware = createHttpMetricsMiddleware();
        const req = { method: "GET", path: "/items/550e8400-e29b-41d4-a716-446655440000" } as any;
        const res = { raw: { statusCode: 200, end: jest.fn() } } as any;
        middleware(req, res, () => {});
        res.raw.end();
    });

    it("preserves non-numeric paths", () => {
        const middleware = createHttpMetricsMiddleware();
        const req = { method: "GET", path: "/api/health" } as any;
        const res = { raw: { statusCode: 200, end: jest.fn() } } as any;
        middleware(req, res, () => {});
        res.raw.end();
    });
});
