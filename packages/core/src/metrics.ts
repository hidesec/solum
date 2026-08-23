export type MetricType = "counter" | "gauge" | "histogram" | "timer";

export interface MetricPoint {
    name: string;
    type: MetricType;
    value: number;
    tags?: Record<string, string>;
    help?: string;
}

class Counter {
    private value = 0;
    constructor(
        public readonly name: string,
        public readonly help: string,
        public readonly tags: Record<string, string> = {}
    ) {}

    increment(amount: number = 1): void {
        this.value += amount;
    }

    getValue(): number {
        return this.value;
    }
}

class Gauge {
    private value = 0;
    constructor(
        public readonly name: string,
        public readonly help: string,
        public readonly tags: Record<string, string> = {}
    ) {}

    set(value: number): void {
        this.value = value;
    }

    increment(amount: number = 1): void {
        this.value += amount;
    }

    decrement(amount: number = 1): void {
        this.value -= amount;
    }

    getValue(): number {
        return this.value;
    }
}

class Histogram {
    private buckets: number[] = [];
    private sum = 0;
    private count = 0;

    constructor(
        public readonly name: string,
        public readonly help: string,
        public readonly bucketBounds: number[] = [5, 10, 25, 50, 100, 250, 500, 1000],
        public readonly tags: Record<string, string> = {}
    ) {
        this.buckets = new Array(bucketBounds.length + 1).fill(0);
    }

    observe(value: number): void {
        this.sum += value;
        this.count++;
        for (let i = 0; i < this.bucketBounds.length; i++) {
            if (value <= this.bucketBounds[i]) {
                this.buckets[i]++;
                return;
            }
        }
        this.buckets[this.bucketBounds.length]++;
    }

    getValue(): { buckets: Record<string, number>; sum: number; count: number } {
        const bucketMap: Record<string, number> = {};
        for (let i = 0; i < this.bucketBounds.length; i++) {
            bucketMap[`le_${this.bucketBounds[i]}`] = this.buckets[i];
        }
        bucketMap["le_inf"] = this.buckets[this.bucketBounds.length];
        return { buckets: bucketMap, sum: this.sum, count: this.count };
    }
}

class Timer {
    private histogram: Histogram;
    private totalDuration = 0;
    private count = 0;

    constructor(
        name: string,
        help: string,
        tags: Record<string, string> = {}
    ) {
        this.histogram = new Histogram(`${name}_duration`, help, [1, 5, 10, 25, 50, 100, 250, 500, 1000], tags);
    }

    record(durationMs: number): void {
        this.histogram.observe(durationMs);
        this.totalDuration += durationMs;
        this.count++;
    }

    getMean(): number {
        return this.count === 0 ? 0 : this.totalDuration / this.count;
    }

    getValue(): { histogram: ReturnType<Histogram["getValue"]>; mean: number; count: number } {
        return {
            histogram: this.histogram.getValue(),
            mean: this.getMean(),
            count: this.count,
        };
    }
}

class MetricsRegistry {
    private counters = new Map<string, Counter>();
    private gauges = new Map<string, Gauge>();
    private histograms = new Map<string, Histogram>();
    private timers = new Map<string, Timer>();

    counter(name: string, help: string = "", tags: Record<string, string> = {}): Counter {
        const key = this.key(name, tags);
        if (!this.counters.has(key)) {
            this.counters.set(key, new Counter(name, help, tags));
        }
        return this.counters.get(key)!;
    }

    gauge(name: string, help: string = "", tags: Record<string, string> = {}): Gauge {
        const key = this.key(name, tags);
        if (!this.gauges.has(key)) {
            this.gauges.set(key, new Gauge(name, help, tags));
        }
        return this.gauges.get(key)!;
    }

    histogram(name: string, help: string = "", bucketBounds?: number[], tags: Record<string, string> = {}): Histogram {
        const key = this.key(name, tags);
        if (!this.histograms.has(key)) {
            this.histograms.set(key, new Histogram(name, help, bucketBounds, tags));
        }
        return this.histograms.get(key)!;
    }

    timer(name: string, help: string = "", tags: Record<string, string> = {}): Timer {
        const key = this.key(name, tags);
        if (!this.timers.has(key)) {
            this.timers.set(key, new Timer(name, help, tags));
        }
        return this.timers.get(key)!;
    }

    private key(name: string, tags: Record<string, string>): string {
        const tagStr = Object.entries(tags).sort().map(([k, v]) => `${k}=${v}`).join(",");
        return `${name}{${tagStr}}`;
    }

    toPrometheus(): string {
        const lines: string[] = [];

        for (const counter of this.counters.values()) {
            if (counter.help) lines.push(`# HELP ${counter.name} ${counter.help}`);
            lines.push(`# TYPE ${counter.name} counter`);
            const tagStr = this.formatTags(counter.tags);
            lines.push(`${counter.name}${tagStr} ${counter.getValue()}`);
        }

        for (const gauge of this.gauges.values()) {
            if (gauge.help) lines.push(`# HELP ${gauge.name} ${gauge.help}`);
            lines.push(`# TYPE ${gauge.name} gauge`);
            const tagStr = this.formatTags(gauge.tags);
            lines.push(`${gauge.name}${tagStr} ${gauge.getValue()}`);
        }

        for (const histogram of this.histograms.values()) {
            if (histogram.help) lines.push(`# HELP ${histogram.name}_bucket ${histogram.help}`);
            lines.push(`# TYPE ${histogram.name}_bucket histogram`);
            const val = histogram.getValue();
            const tagStr = this.formatTags(histogram.tags);
            for (const [le, count] of Object.entries(val.buckets)) {
                const leValue = le === "le_inf" ? "+Inf" : le.replace("le_", "");
                lines.push(`${histogram.name}_bucket{le="${leValue}"${tagStr ? "," + tagStr.slice(1) : ""}} ${count}`);
            }
            lines.push(`${histogram.name}_sum${tagStr} ${val.sum}`);
            lines.push(`${histogram.name}_count${tagStr} ${val.count}`);
        }

        for (const timer of this.timers.values()) {
            if (timer) {
                const val = timer.getValue();
                const tagStr = this.formatTags(timer["histogram"].tags);
                lines.push(`# HELP ${timer["histogram"].name}_bucket Timer duration`);
                lines.push(`# TYPE ${timer["histogram"].name}_bucket histogram`);
                for (const [le, count] of Object.entries(val.histogram.buckets)) {
                    const leValue = le === "le_inf" ? "+Inf" : le.replace("le_", "");
                    lines.push(`${timer["histogram"].name}_bucket{le="${leValue}"${tagStr ? "," + tagStr.slice(1) : ""}} ${count}`);
                }
                lines.push(`${timer["histogram"].name}_sum${tagStr} ${val.histogram.sum}`);
                lines.push(`${timer["histogram"].name}_count${tagStr} ${val.histogram.count}`);
            }
        }

        return lines.join("\n") + "\n";
    }

    toJson(): Record<string, unknown> {
        const result: Record<string, unknown> = {};

        for (const [key, counter] of this.counters) {
            result[key] = { type: "counter", value: counter.getValue() };
        }
        for (const [key, gauge] of this.gauges) {
            result[key] = { type: "gauge", value: gauge.getValue() };
        }
        for (const [key, histogram] of this.histograms) {
            result[key] = { type: "histogram", ...histogram.getValue() };
        }
        for (const [key, timer] of this.timers) {
            result[key] = { type: "timer", ...timer.getValue() };
        }

        return result;
    }

    reset(): void {
        this.counters.clear();
        this.gauges.clear();
        this.histograms.clear();
        this.timers.clear();
    }

    private formatTags(tags: Record<string, string>): string {
        const entries = Object.entries(tags);
        if (entries.length === 0) return "";
        return "{" + entries.map(([k, v]) => `${k}="${v}"`).join(",") + "}";
    }
}

export const metrics = new MetricsRegistry();
