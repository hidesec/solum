import "@solumjs/core";
import { container, registerBeanPostProcessor } from "@solumjs/core";
import { matchesPointcut, parsePointcut, ParsedPointcut } from "./pointcut";
import type { JoinPoint } from "./aspect.decorator";

const CB_METADATA = "custom:circuit-breaker";
const RETRY_METADATA = "custom:retry";

interface CircuitBreakerMeta {
    methodName: string;
    options: { failureThreshold?: number; resetTimeoutMs?: number; halfOpenMaxCalls?: number };
}

interface RetryMeta {
    methodName: string;
    options: { maxAttempts?: number; backoffMs?: number; backoffMultiplier?: number; maxBackoffMs?: number };
}

function getCircuitBreakerState(name: string, options: { failureThreshold: number; resetTimeoutMs: number }) {
    const state = { failureCount: 0, lastFailureTime: 0, state: "CLOSED" as "CLOSED" | "OPEN" | "HALF_OPEN", halfOpenCalls: 0 };
    return {
        canExecute: () => {
            if (state.state === "OPEN" && Date.now() - state.lastFailureTime >= options.resetTimeoutMs) {
                state.state = "HALF_OPEN";
                state.halfOpenCalls = 0;
            }
            if (state.state === "CLOSED") return true;
            if (state.state === "HALF_OPEN" && state.halfOpenCalls < 1) { state.halfOpenCalls++; return true; }
            return false;
        },
        recordSuccess: () => { if (state.state === "HALF_OPEN") { state.state = "CLOSED"; state.failureCount = 0; } },
        recordFailure: () => { state.failureCount++; state.lastFailureTime = Date.now(); if (state.state === "HALF_OPEN" || state.failureCount >= options.failureThreshold) state.state = "OPEN"; },
    };
}

export const ADVICE_METADATA_KEY = "custom:aspect-advices";
export const ASPECT_MARKER_KEY = "custom:solum-aspect";

export type AdviceKind = "before" | "after" | "after-returning" | "after-throwing" | "around";

export interface AdviceMeta {
    kind: AdviceKind;
    expression: string;
    methodName: string;
}

const aspectRegistry: Function[] = [];
const resolvedAspects = new Map<Function, unknown>();
const pointcutCache = new Map<string, ParsedPointcut>();
let wovenPrototypes = new WeakSet<object>();

let autoProxyInstalled = false;

export function registerAspectClass(aspectCtor: Function): void {
    if (!aspectRegistry.includes(aspectCtor)) {
        aspectRegistry.push(aspectCtor);
    }
}

function getParsed(expression: string): ParsedPointcut {
    let parsed = pointcutCache.get(expression);
    if (!parsed) {
        parsed = parsePointcut(expression);
        pointcutCache.set(expression, parsed);
    }
    return parsed;
}

interface WovenEntry {
    kind: AdviceKind;
    parsed: ParsedPointcut;
    invoke(joinPoint: JoinPoint, proceed?: () => Promise<any>, extra?: unknown): any;
}

function collectEntries(className: string, methodName: string): WovenEntry[] {
    const entries: WovenEntry[] = [];
    for (const aspectCtor of aspectRegistry) {
        const metas: AdviceMeta[] =
            (Reflect.getMetadata(ADVICE_METADATA_KEY, aspectCtor) as AdviceMeta[] | undefined) ?? [];
        if (metas.length === 0) continue;

        let aspectInstance = resolvedAspects.get(aspectCtor);
        if (aspectInstance === undefined) {
            aspectInstance = container.resolve(aspectCtor as new () => any);
            resolvedAspects.set(aspectCtor, aspectInstance);
        }

        for (const meta of metas) {
            const parsed = getParsed(meta.expression);
            if (!matchesPointcut(parsed, className, methodName)) continue;
            const raw = (aspectInstance as Record<string, unknown>)[meta.methodName];
            if (typeof raw !== "function") continue;
            const bound = (raw as (...fnArgs: any[]) => any).bind(aspectInstance);
            entries.push({
                kind: meta.kind,
                parsed,
                invoke: (joinPoint, proceed, extra) =>
                    meta.kind === "around" ? bound(joinPoint, proceed) : bound(joinPoint, extra),
            });
        }
    }
    return entries;
}

function invokeChain(entries: WovenEntry[], index: number, joinPoint: JoinPoint, proceed: () => Promise<any>): Promise<any> {
    if (index >= entries.length) {
        try {
            return Promise.resolve(proceed());
        } catch (err) {
            return Promise.reject(err);
        }
    }
    const entry = entries[index];
    const next = () => invokeChain(entries, index + 1, joinPoint, proceed);

    switch (entry.kind) {
        case "before":
            return Promise.resolve(entry.invoke(joinPoint)).then(next);
        case "after-returning":
            return next().then((result) =>
                Promise.resolve(entry.invoke(joinPoint, undefined, result)).then((replaced) =>
                    replaced === undefined ? result : replaced
                )
            );
        case "after-throwing":
            return next().catch((err: unknown) =>
                Promise.resolve(entry.invoke(joinPoint, undefined, err)).then((recovered) => {
                    if (recovered !== undefined) return recovered;
                    throw err;
                })
            );
        case "after":
            return next().then(
                (result) => Promise.resolve(entry.invoke(joinPoint)).then(() => result),
                (err: unknown) =>
                    Promise.resolve(entry.invoke(joinPoint)).then(() => {
                        throw err;
                    })
            );
        case "around":
            return Promise.resolve(entry.invoke(joinPoint, next));
    }
}

function isAspectInstance(instance: object): boolean {
    return (
        Reflect.getMetadata(ASPECT_MARKER_KEY, (instance as { constructor: Function }).constructor) === true ||
        Reflect.getMetadata(ASPECT_MARKER_KEY, instance) === true
    );
}

export function weaveIfApplicable<T>(instance: T): T {
    if (!instance || (typeof instance !== "object" && typeof instance !== "function")) {
        return instance;
    }
    const ctor = (instance as { constructor?: Function }).constructor as Function | undefined;
    if (!ctor || !ctor.prototype || ctor.prototype === Object.prototype) return instance;
    if (isAspectInstance(instance as object)) return instance;
    if (aspectRegistry.length === 0) return instance;

    const prototype = ctor.prototype as Record<string | symbol, unknown>;
    if (wovenPrototypes.has(prototype)) return instance;

    const className = ((instance as { constructor: { name?: string } }).constructor.name) ?? "";

    let totalEntries = 0;
    const candidates: { key: string; descriptor: PropertyDescriptor; entries: WovenEntry[] }[] = [];

    for (const propertyKey of Object.getOwnPropertyNames(prototype)) {
        if (propertyKey === "constructor") continue;
        const descriptor = Object.getOwnPropertyDescriptor(prototype, propertyKey);
        if (!descriptor || typeof descriptor.value !== "function") continue;

        const entries = collectEntries(className, propertyKey);
        const cbMeta: CircuitBreakerMeta[] = (Reflect.getOwnMetadata(CB_METADATA, ctor) as CircuitBreakerMeta[]) || [];
        const retryMeta: RetryMeta[] = (Reflect.getOwnMetadata(RETRY_METADATA, ctor) as RetryMeta[]) || [];
        const hasCb = cbMeta.some((m) => m.methodName === propertyKey);
        const hasRetry = retryMeta.some((m) => m.methodName === propertyKey);

        if (entries.length === 0 && !hasCb && !hasRetry) continue;
        totalEntries += entries.length;
        candidates.push({ key: propertyKey, descriptor, entries });
    }

    if (totalEntries === 0) return instance;
    wovenPrototypes.add(prototype);

    for (const candidate of candidates) {
        const original = candidate.descriptor.value as (...args: any[]) => any;
        const methodName = candidate.key;
        const entries = candidate.entries;

        const cbMeta: CircuitBreakerMeta[] = (Reflect.getOwnMetadata(CB_METADATA, ctor) as CircuitBreakerMeta[]) || [];
        const retryMeta: RetryMeta[] = (Reflect.getOwnMetadata(RETRY_METADATA, ctor) as RetryMeta[]) || [];
        const cb = cbMeta.find((m) => m.methodName === methodName);
        const retry = retryMeta.find((m) => m.methodName === methodName);

        const woven = function (this: any, ...args: any[]) {
            const exec = () => {
                const joinPoint: JoinPoint = { target: this, className, methodName, args };
                const active = entries.filter((entry) =>
                    matchesPointcut(entry.parsed, className, methodName, args.length)
                );
                if (active.length === 0) return original.apply(this, args);
                return invokeChain(active, 0, joinPoint, () => original.apply(this, args));
            };

            let fn = exec;

            if (retry) {
                const { maxAttempts = 3, backoffMs = 100, backoffMultiplier = 2, maxBackoffMs = 30000 } = retry.options;
                const retryFn = async () => {
                    let lastError: unknown;
                    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
                        try { return await fn(); } catch (error) {
                            lastError = error;
                            if (attempt < maxAttempts) {
                                await new Promise((r) => setTimeout(r, Math.min(backoffMs * Math.pow(backoffMultiplier, attempt - 1), maxBackoffMs)));
                            }
                        }
                    }
                    throw lastError;
                };
                fn = retryFn;
            }

            if (cb) {
                const breaker = getCircuitBreakerState(`${className}.${methodName}`, {
                    failureThreshold: cb.options.failureThreshold ?? 5,
                    resetTimeoutMs: cb.options.resetTimeoutMs ?? 30000,
                });
                const cbFn = async () => {
                    if (!breaker.canExecute()) throw new Error(`Circuit breaker OPEN for ${className}.${methodName}`);
                    try { const result = await fn(); breaker.recordSuccess(); return result; }
                    catch (error) { breaker.recordFailure(); throw error; }
                };
                fn = cbFn;
            }

            return fn();
        };

        Object.defineProperty(prototype, methodName, {
            ...candidate.descriptor,
            value: woven,
        });
    }

    return instance;
}

export function installAspectAutoProxy(): void {
    if (autoProxyInstalled) return;
    autoProxyInstalled = true;
    registerBeanPostProcessor({
        postProcessBeforeInitialization(instance: unknown): unknown {
            return weaveIfApplicable(instance);
        },
    });
}

export function resetAspectInfrastructure(): void {
    aspectRegistry.length = 0;
    resolvedAspects.clear();
    pointcutCache.clear();
    wovenPrototypes = new WeakSet();
    autoProxyInstalled = false;
}
