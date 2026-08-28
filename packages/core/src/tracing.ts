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
    traceFlags?: number;
    traceState?: string;
    sampled?: boolean;
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
    traceFlags: number;
    traceState?: string;
    sampled: boolean;
}

const traceStorage = new AsyncLocalStorage<TraceContext>();

function generateId(bytes: number = 16): string {
    return crypto.randomBytes(bytes).toString("hex");
}

function shouldSample(sampleRate: number): boolean {
    if (sampleRate <= 0) return false;
    if (sampleRate >= 1) return true;
    return crypto.randomBytes(4).readUInt32BE(0) / 0xFFFFFFFF < sampleRate;
}

export function startTrace(name: string, attributes: Record<string, string | number | boolean> = {}): TraceSpan {
    const existing = traceStorage.getStore();
    const traceId = existing?.traceId || generateId();
    const spanId = generateId().slice(0, 16);
    const parentSpanId = existing?.spanId;
    const traceFlags = existing?.traceFlags ?? 1;
    const traceState = existing?.traceState;
    const sampled = existing?.sampled ?? true;

    const span: TraceSpan = {
        traceId,
        spanId,
        parentSpanId,
        name,
        startTime: Date.now(),
        status: "OK",
        attributes,
        events: [],
        traceFlags,
        traceState,
        sampled,
    };

    if (existing) {
        existing.spans.push(span);
        existing.spanId = spanId;
    } else {
        traceStorage.enterWith({ traceId, spanId, spans: [span], traceFlags, traceState, sampled });
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

const MAX_TRACE_ID_LENGTH = 128;
const HEX_PATTERN = /^[0-9a-f]+$/;

export function createTraceMiddleware() {
    const collectedSpans: TraceSpan[] = [];

    return {
        middleware(req: any, _res: any, next: () => void) {
            const rawTraceId = req.headers?.["x-trace-id"];
            const traceId = (typeof rawTraceId === "string" && rawTraceId.length <= MAX_TRACE_ID_LENGTH && HEX_PATTERN.test(rawTraceId))
                ? rawTraceId
                : generateId();
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

            traceStorage.run({ traceId, spanId, spans: [span], traceFlags: 1, sampled: true }, () => {
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

export interface W3CTraceContext {
    traceparent: string;
    tracestate?: string;
}

const TRACEPARENT_REGEX = /^00-([0-9a-f]{32})-([0-9a-f]{16})-([0-9a-f]{2})(?:-([0-9a-f]{2}(?:-[0-9a-f]+)*))?$/;

export function parseTraceparent(header: string): W3CTraceContext | null {
    const match = header.match(TRACEPARENT_REGEX);
    if (!match) return null;

    return {
        traceparent: header,
        tracestate: undefined,
    };
}

export function createTraceparent(traceId: string, spanId: string, traceFlags: number = 1): string {
    const paddedFlags = traceFlags.toString(16).padStart(2, "0");
    return `00-${traceId}-${spanId}-${paddedFlags}`;
}

export function extractW3CContext(headers: Record<string, string | string[] | undefined>): W3CTraceContext | null {
    const traceparent = headers["traceparent"];
    if (typeof traceparent !== "string") return null;

    const parsed = parseTraceparent(traceparent);
    if (!parsed) return null;

    const tracestate = headers["tracestate"];
    if (typeof tracestate === "string") {
        parsed.tracestate = tracestate;
    }

    return parsed;
}

export function injectW3CContext(traceId: string, spanId: string, traceFlags: number = 1): Record<string, string> {
    const headers: Record<string, string> = {
        "traceparent": createTraceparent(traceId, spanId, traceFlags),
    };

    const ctx = traceStorage.getStore();
    if (ctx?.traceState) {
        headers["tracestate"] = ctx.traceState;
    }

    return headers;
}

const SAFE_HEADER_VALUE = /^[a-zA-Z0-9._\-]+$/;
const MAX_HEADER_VALUE_LENGTH = 256;

function sanitizeHeaderValue(value: string): string {
    if (value.length > MAX_HEADER_VALUE_LENGTH) {
        value = value.substring(0, MAX_HEADER_VALUE_LENGTH);
    }
    if (!SAFE_HEADER_VALUE.test(value)) {
        return "";
    }
    return value;
}

export interface W3CTraceMiddlewareOptions {
    sampleRate?: number;
    propagateHeaders?: string[];
    ignorePaths?: string[];
}

export function createW3CTraceMiddleware(options: W3CTraceMiddlewareOptions = {}) {
    const collectedSpans: TraceSpan[] = [];
    const sampleRate = options.sampleRate ?? 1.0;
    const propagateHeaders = options.propagateHeaders ?? ["x-request-id", "x-correlation-id"];
    const ignorePaths = options.ignorePaths ?? ["/actuator", "/health"];

    return {
        middleware(req: any, res: any, next: () => void) {
            const path = req.url || "/";
            if (ignorePaths.some((p) => path.startsWith(p))) {
                next();
                return;
            }

            const w3cCtx = extractW3CContext(req.headers || {});

            let traceId: string;
            let spanId: string;
            let traceFlags: number = 1;
            let traceState: string | undefined;
            let sampled = true;

            if (w3cCtx) {
                const parts = w3cCtx.traceparent.split("-");
                traceId = parts[1];
                spanId = parts[2];
                traceFlags = parseInt(parts[3], 16) || 1;
                traceState = w3cCtx.tracestate;
                sampled = (traceFlags & 1) === 1;
            } else {
                traceId = generateId();
                spanId = generateId().slice(0, 16);
                sampled = shouldSample(sampleRate);
                traceFlags = sampled ? 1 : 0;
            }

            if (!sampled) {
                next();
                return;
            }

            const correlationHeaders: Record<string, string> = {};
            for (const header of propagateHeaders) {
                const value = req.headers?.[header];
                if (typeof value === "string") {
                    const sanitized = sanitizeHeaderValue(value);
                    if (sanitized) {
                        correlationHeaders[header] = sanitized;
                    }
                }
            }

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
                    "trace_id": traceId,
                    "span_id": spanId,
                    "trace_flags": traceFlags,
                    ...correlationHeaders,
                },
                events: [],
                traceFlags,
                traceState,
                sampled,
            };

            const responseHeaders = injectW3CContext(traceId, spanId, traceFlags);
            for (const [key, value] of Object.entries(responseHeaders)) {
                res.setHeader?.(key, value);
            }
            for (const [key, value] of Object.entries(correlationHeaders)) {
                res.setHeader?.(key, value);
            }

            traceStorage.run({ traceId, spanId, spans: [span], traceFlags, traceState, sampled }, () => {
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
