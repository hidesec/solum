import crypto from "crypto";
import { AsyncLocalStorage } from "async_hooks";

export interface TraceSpan {
    traceId: string;
    spanId: string;
    parentSpanId?: string;
    name: string;
    startTime: number;
    endTime?: number;
    status: "OK" | "ERROR";
    attributes: Record<string, string | number | boolean>;
    events: TraceEvent[];
}

export interface TraceEvent {
    name: string;
    timestamp: number;
    attributes?: Record<string, string>;
}

interface TraceContext {
    traceId: string;
    spanId: string;
    spans: TraceSpan[];
}

const traceStorage = new AsyncLocalStorage<TraceContext>();

function generateId(): string {
    return crypto.randomBytes(16).toString("hex");
}

export function startTrace(name: string, attributes: Record<string, string | number | boolean> = {}): TraceSpan {
    const existing = traceStorage.getStore();
    const traceId = existing?.traceId || generateId();
    const spanId = generateId().slice(0, 16);
    const parentSpanId = existing?.spanId;

    const span: TraceSpan = {
        traceId,
        spanId,
        parentSpanId,
        name,
        startTime: Date.now(),
        status: "OK",
        attributes,
        events: [],
    };

    if (existing) {
        existing.spans.push(span);
        existing.spanId = spanId;
    } else {
        traceStorage.enterWith({ traceId, spanId, spans: [span] });
    }

    return span;
}

export function endSpan(span: TraceSpan, error?: Error): void {
    span.endTime = Date.now();
    if (error) {
        span.status = "ERROR";
        span.attributes["error.message"] = error.message;
    }
}

export function addEvent(name: string, attributes?: Record<string, string>): void {
    const ctx = traceStorage.getStore();
    if (!ctx || ctx.spans.length === 0) return;
    const span = ctx.spans[ctx.spans.length - 1];
    span.events.push({ name, timestamp: Date.now(), attributes });
}

export function setAttribute(key: string, value: string | number | boolean): void {
    const ctx = traceStorage.getStore();
    if (!ctx || ctx.spans.length === 0) return;
    ctx.spans[ctx.spans.length - 1].attributes[key] = value;
}

export function getTraceId(): string | undefined {
    return traceStorage.getStore()?.traceId;
}

export function getSpanId(): string | undefined {
    return traceStorage.getStore()?.spanId;
}

export function getTraceContext(): { traceId: string; spanId: string } | undefined {
    const ctx = traceStorage.getStore();
    if (!ctx) return undefined;
    return { traceId: ctx.traceId, spanId: ctx.spanId };
}

export function getTraceHeaders(): Record<string, string> {
    const ctx = traceStorage.getStore();
    if (!ctx) return {};
    return {
        "x-trace-id": ctx.traceId,
        "x-span-id": ctx.spanId,
    };
}

export function getCurrentSpans(): TraceSpan[] {
    return traceStorage.getStore()?.spans || [];
}

export async function trace<T>(name: string, fn: () => Promise<T>, attributes?: Record<string, string | number | boolean>): Promise<T> {
    const span = startTrace(name, attributes);
    try {
        const result = await fn();
        endSpan(span);
        return result;
    } catch (error) {
        endSpan(span, error as Error);
        throw error;
    }
}

export function createTraceMiddleware() {
    const collectedSpans: TraceSpan[] = [];

    return {
        middleware(req: any, _res: any, next: () => void) {
            const traceId = req.headers?.["x-trace-id"] || generateId();
            const spanId = generateId().slice(0, 16);

            const span: TraceSpan = {
                traceId,
                spanId,
                name: `${req.method || "unknown"} ${req.url || "/"}`,
                startTime: Date.now(),
                status: "OK",
                attributes: {
                    "http.method": req.method || "unknown",
                    "http.url": req.url || "/",
                    "http.user_agent": req.headers?.["user-agent"] || "",
                },
                events: [],
            };

            traceStorage.run({ traceId, spanId, spans: [span] }, () => {
                next();
            });

            collectedSpans.push(span);
        },
        getCollectedSpans(): TraceSpan[] {
            return collectedSpans;
        },
        clearSpans(): void {
            collectedSpans.length = 0;
        },
    };
}

export interface TracingExporter {
    export(spans: TraceSpan[]): Promise<void>;
}

export class ConsoleExporter implements TracingExporter {
    async export(spans: TraceSpan[]): Promise<void> {
        for (const span of spans) {
            const duration = span.endTime ? span.endTime - span.startTime : 0;
            console.log(
                `[TRACE] ${span.traceId} | ${span.name} | ${duration}ms | ${span.status}`,
                span.attributes
            );
        }
    }
}

export class InMemoryExporter implements TracingExporter {
    private spans: TraceSpan[] = [];

    async export(spans: TraceSpan[]): Promise<void> {
        this.spans.push(...spans);
    }

    getSpans(): TraceSpan[] {
        return [...this.spans];
    }

    clear(): void {
        this.spans.length = 0;
    }
}
