import { metrics } from "../metrics";

describe("MetricsRegistry", () => {
    beforeEach(() => {
        metrics.reset();
    });

    describe("counter", () => {
        it("increments counter", () => {
            const c = metrics.counter("req_count", "Request count");
            c.increment();
            c.increment(5);
            expect(c.getValue()).toBe(6);
        });

        it("caches same counter by name+tags", () => {
            const a = metrics.counter("x", "", { env: "prod" });
            const b = metrics.counter("x", "", { env: "prod" });
            expect(a).toBe(b);
        });

        it("creates separate counters for different tags", () => {
            const a = metrics.counter("y", "", { env: "prod" });
            const b = metrics.counter("y", "", { env: "dev" });
            expect(a).not.toBe(b);
        });
    });

    describe("gauge", () => {
        it("set, increment, decrement", () => {
            const g = metrics.gauge("connections", "DB connections");
            g.set(10);
            g.increment(3);
            expect(g.getValue()).toBe(13);
            g.decrement(5);
            expect(g.getValue()).toBe(8);
        });
    });

    describe("histogram", () => {
        it("observes values and computes buckets", () => {
            const h = metrics.histogram("latency", "Latency", [10, 50, 100]);
            h.observe(5);
            h.observe(30);
            h.observe(200);
            const val = h.getValue();
            expect(val.count).toBe(3);
            expect(val.sum).toBe(235);
            expect(val.buckets["le_10"]).toBe(1);
            expect(val.buckets["le_50"]).toBe(1);
            expect(val.buckets["le_100"]).toBe(0);
            expect(val.buckets["le_inf"]).toBe(1);
        });
    });

    describe("timer", () => {
        it("records durations and computes mean", () => {
            const t = metrics.timer("req_duration", "Duration");
            t.record(100);
            t.record(200);
            t.record(300);
            const val = t.getValue();
            expect(val.count).toBe(3);
            expect(val.mean).toBe(200);
            expect(val.histogram.sum).toBe(600);
        });

        it("returns 0 mean when no recordings", () => {
            const t = metrics.timer("empty_timer");
            expect(t.getValue().mean).toBe(0);
        });
    });

    describe("toPrometheus", () => {
        it("formats counter in Prometheus format", () => {
            const c = metrics.counter("http_total", "Total requests");
            c.increment(42);
            const output = metrics.toPrometheus();
            expect(output).toContain("# TYPE http_total counter");
            expect(output).toContain("http_total 42");
        });

        it("formats gauge", () => {
            const g = metrics.gauge("mem_used", "Memory");
            g.set(1024);
            const output = metrics.toPrometheus();
            expect(output).toContain("# TYPE mem_used gauge");
            expect(output).toContain("mem_used 1024");
        });

        it("formats histogram", () => {
            const h = metrics.histogram("resp_time", "Response time", [10, 50]);
            h.observe(3);
            const output = metrics.toPrometheus();
            expect(output).toContain("resp_time_bucket");
            expect(output).toContain("resp_time_sum");
            expect(output).toContain("resp_time_count");
        });

        it("formats timer", () => {
            const t = metrics.timer("exec_time");
            t.record(42);
            const output = metrics.toPrometheus();
            expect(output).toContain("exec_time_duration_bucket");
        });

        it("includes help text", () => {
            metrics.counter("c_with_help", "My help text");
            const output = metrics.toPrometheus();
            expect(output).toContain("# HELP c_with_help My help text");
        });

        it("includes tags in output", () => {
            const c = metrics.counter("tagged_c", "", { env: "prod" });
            c.increment(1);
            const output = metrics.toPrometheus();
            expect(output).toContain('env="prod"');
        });
    });

    describe("toJson", () => {
        it("formats all metric types as JSON", () => {
            metrics.counter("jc").increment(5);
            metrics.gauge("jg").set(10);
            metrics.histogram("jh", "", [100]).observe(50);
            metrics.timer("jt").record(25);
            const json = metrics.toJson();
            const counterKey = Object.keys(json).find(k => k.startsWith("jc{"));
            const gaugeKey = Object.keys(json).find(k => k.startsWith("jg{"));
            expect(json[counterKey!]).toEqual({ type: "counter", value: 5 });
            expect(json[gaugeKey!]).toEqual({ type: "gauge", value: 10 });
            const histKey = Object.keys(json).find(k => k.startsWith("jh{"));
            const timerKey = Object.keys(json).find(k => k.startsWith("jt{"));
            expect(json[histKey!]).toBeDefined();
            expect(json[timerKey!]).toBeDefined();
        });
    });

    describe("reset", () => {
        it("clears all metrics", () => {
            metrics.counter("rc").increment(1);
            metrics.gauge("rg").set(1);
            metrics.reset();
            expect(metrics.toPrometheus()).not.toContain("rc");
        });
    });
});
