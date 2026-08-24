import "./reflect-metadata";
import { AsyncLocalStorage } from "async_hooks";

export type Token<T = unknown> = string | (new (...args: any[]) => T);
export type BeanScope = "singleton" | "prototype" | "request" | "session";

export interface ClassRegistration {
    useClass: new (...args: any[]) => any;
    when?: () => boolean;
    scope?: BeanScope;
    lazy?: boolean;
}

export interface ValueRegistration {
    useValue: unknown;
}

export type Registration = ClassRegistration | ValueRegistration;

export interface InjectOptions {
    qualifier?: string;
    lazy?: boolean;
}

export interface BeanMeta {
    name?: string;
    primary?: boolean;
    order?: number;
    scope?: BeanScope;
    lazy?: boolean;
}

const INJECT_METADATA_KEY = "custom:inject-tokens";

interface InjectSpec {
    token: Token;
    options?: InjectOptions & { all?: boolean };
}

interface BeanEntry {
    name: string;
    registration: Registration;
    primary: boolean;
    order: number;
    cached?: { value: unknown };
}

interface DeferredRef {
    target?: unknown;
}

export interface BeanDefinitionHandle {
    readonly token: Token;
    readonly name: string;
    getScope(): BeanScope | undefined;
    setScope(scope: BeanScope): void;
    getWhen(): (() => boolean) | undefined;
    setWhen(when: (() => boolean) | undefined): void;
    setLazy(lazy: boolean): void;
    markPrimary(): void;
    setOrder(order: number): void;
    replaceClass(ctor: new (...args: any[]) => any): void;
}

export interface BeanDefinitionRegistry {
    getDefinitions(): BeanDefinitionHandle[];
    register(token: Token, registration: Registration, meta?: BeanMeta): void;
}

export interface BeanPostProcessor {
    postProcessBeforeInitialization?(instance: unknown, beanName: string, token: Token): unknown;
    postProcessAfterInitialization?(instance: unknown, beanName: string, token: Token): unknown;
}

type BeanFactoryPostProcessor = (registry: BeanDefinitionRegistry) => void;

const definitions = new Map<Token, BeanEntry[]>();
const inCreation = new Set<Token>();
const pendingProxies = new Map<Token, DeferredRef[]>();
const sessionBeans = new Map<string, { instance: unknown; expiresAt: number }>();

const SESSION_BEAN_TTL_MS = 30 * 60 * 1000;

function sweepSessionBeans(): void {
    const now = Date.now();
    for (const [key, entry] of sessionBeans) {
        if (entry.expiresAt <= now) {
            sessionBeans.delete(key);
        }
    }
}
setInterval(sweepSessionBeans, 5 * 60 * 1000).unref();

const beanPostProcessors: BeanPostProcessor[] = [];
let beanFactoryPostProcessors: BeanFactoryPostProcessor[] = [];
let factoryProcessed = false;

const resolutionListeners = new Map<Token, ((token: Token, instance: unknown) => void)[]>();

const requestStorage = new AsyncLocalStorage<{ beans: Map<BeanEntry, unknown>; sessionId?: string }>();

function activeEntries(token: Token): BeanEntry[] {
    const entries = entriesFor(token);
    return entries.filter((e) => {
        const reg = e.registration as ClassRegistration;
        return !reg.when || reg.when();
    });
}

function entriesFor(token: Token): BeanEntry[] {
    ensureFactoryProcessed();
    const direct = definitions.get(token);
    if (direct !== undefined || typeof token !== "function") return direct ?? [];
    return definitions.get(token.name) ?? [];
}

function ensureFactoryProcessed(): void {
    if (factoryProcessed) return;
    factoryProcessed = true;
    const processors = beanFactoryPostProcessors;
    beanFactoryPostProcessors = [];
    const registry: BeanDefinitionRegistry = {
        getDefinitions(): BeanDefinitionHandle[] {
            const handles: BeanDefinitionHandle[] = [];
            definitions.forEach((entries, token) => {
                entries.forEach((entry) => handles.push(toHandle(token, entry)));
            });
            return handles;
        },
        register(token, registration, meta) {
            registerBean(token, registration, meta);
        },
    };
    processors.forEach((process) => process(registry));
}

function toHandle(token: Token, entry: BeanEntry): BeanDefinitionHandle {
    return {
        token,
        name: entry.name,
        getScope: () => (entry.registration as ClassRegistration).scope,
        setScope: (scope) => {
            (entry.registration as ClassRegistration).scope = scope;
        },
        getWhen: () => (entry.registration as ClassRegistration).when,
        setWhen: (when) => {
            (entry.registration as ClassRegistration).when = when;
        },
        setLazy: (lazy) => {
            (entry.registration as ClassRegistration).lazy = lazy;
        },
        markPrimary: () => {
            entry.primary = true;
        },
        setOrder: (order) => {
            entry.order = order;
        },
        replaceClass: (ctor) => {
            (entry.registration as ClassRegistration).useClass = ctor;
        },
    };
}

function pickCandidate(token: Token, qualifier?: string): BeanEntry {
    const actives = activeEntries(token);

    if (actives.length === 0) {
        const known = definitions.has(token) || (typeof token === "function" && definitions.has(token.name));
        throw new Error(
            known
                ? `No eligible bean for token "${String(token)}": every candidate failed its conditional (@Profile/@ConditionalOnProperty).`
                : `Attempted to resolve unregistered dependency token: "${String(token)}"`
        );
    }

    if (qualifier !== undefined) {
        const matched = actives.find((e) => e.name === qualifier);
        if (!matched) {
            const names = actives.map((e) => `"${e.name}"`).join(", ");
            throw new Error(
                `No bean named "${qualifier}" for token "${String(token)}". Available candidates: ${names}`
            );
        }
        return matched;
    }

    if (actives.length === 1) return actives[0];

    const primaries = actives.filter((e) => e.primary);
    if (primaries.length === 1) return primaries[0];
    if (primaries.length > 1) {
        throw new Error(
            `Multiple @Primary beans for token "${String(token)}": ${primaries.map((e) => `"${e.name}"`).join(", ")}`
        );
    }

    const names = actives.map((e) => `"${e.name}"`).join(", ");
    throw new Error(
        `Multiple beans for token "${String(token)}" (${names}). Use a qualifier or mark one with @Primary.`
    );
}

function createDeferredProxy(token: Token, ref: DeferredRef): unknown {
    const placeholder = function placeholder(): void {};
    return new Proxy(placeholder, {
        get(_t, prop) {
            if (!ref.target) {
                throw new Error(
                    `Circular dependency on "${String(token)}" is not ready yet. The proxied bean is still being created.`
                );
            }
            const value = Reflect.get(ref.target as object, prop, ref.target);
            return typeof value === "function" ? value.bind(ref.target) : value;
        },
        set(_t, prop, value) {
            const target = ref.target as Record<string | symbol, unknown>;
            target[prop] = value;
            return true;
        },
        apply(_t, thisArg, args) {
            if (!ref.target) {
                throw new Error(`Circular dependency on "${String(token)}" is not ready yet.`);
            }
            return Reflect.apply(ref.target as () => unknown, ref.target, args);
        },
        getPrototypeOf() {
            return null;
        },
    });
}

function flushPendingProxies(token: Token, instance: unknown): void {
    const pending = pendingProxies.get(token);
    if (!pending) return;
    pending.forEach((ref) => {
        ref.target = instance;
    });
    pendingProxies.delete(token);
}

function instantiate(entry: BeanEntry, token: Token): unknown {
    const reg = entry.registration as ClassRegistration;
    let instance = construct(reg.useClass);

    for (const processor of beanPostProcessors) {
        if (processor.postProcessBeforeInitialization) {
            instance = processor.postProcessBeforeInitialization(instance, entry.name, token) ?? instance;
        }
    }

    notifyListeners(token, instance);

    for (const processor of beanPostProcessors) {
        if (processor.postProcessAfterInitialization) {
            instance = processor.postProcessAfterInitialization(instance, entry.name, token) ?? instance;
        }
    }

    return instance;
}

function resolveClassBean(token: Token, entry: BeanEntry): unknown {
    const reg = entry.registration as ClassRegistration;
    const scope = reg.scope ?? "singleton";

    if (scope === "prototype") {
        if (inCreation.has(token)) {
            throw new Error(
                `Circular dependency detected for prototype bean "${String(token)}". Prototypes cannot participate in circular references.`
            );
        }
        inCreation.add(token);
        try {
            return instantiate(entry, token);
        } finally {
            inCreation.delete(token);
        }
    }

    if (scope === "request") {
        const store = requestStorage.getStore();
        if (!store) {
            throw new Error(
                `Request-scoped bean "${String(token)}" accessed outside of an HTTP request. Inject it via @AutoWired (property access happens during the request) instead of constructor injection into a singleton.`
            );
        }
        const cached = store.beans.get(entry);
        if (cached !== undefined) return cached;
        const instance = instantiate(entry, token);
        store.beans.set(entry, instance);
        return instance;
    }

    if (scope === "session") {
        const store = requestStorage.getStore();
        if (!store) {
            throw new Error(
                `Session-scoped bean "${String(token)}" accessed outside of an HTTP request.`
            );
        }
        const sessionId = store.sessionId;
        if (!sessionId) {
            throw new Error(
                `Session-scoped bean "${String(token)}" requires an active session. Ensure session middleware is enabled.`
            );
        }
        const sessionKey = `session:${sessionId}:${String(token)}`;
        const cached = sessionBeans.get(sessionKey);
        if (cached !== undefined && cached.expiresAt > Date.now()) return cached.instance;
        const instance = instantiate(entry, token);
        sessionBeans.set(sessionKey, { instance, expiresAt: Date.now() + SESSION_BEAN_TTL_MS });
        return instance;
    }

    if (entry.cached !== undefined) return entry.cached.value;

    if (inCreation.has(token)) {
        const ref: DeferredRef = { target: undefined };
        const pending = pendingProxies.get(token) ?? [];
        pending.push(ref);
        pendingProxies.set(token, pending);
        return createDeferredProxy(token, ref);
    }

    inCreation.add(token);
    try {
        const instance = instantiate(entry, token);
        entry.cached = { value: instance };
        flushPendingProxies(token, instance);
        return instance;
    } finally {
        inCreation.delete(token);
    }
}

export function resolve<T = unknown>(token: Token<T>, options?: InjectOptions): T {
    const entries = activeEntries(token);

    if (
        entries.length === 0 &&
        typeof token === "function" &&
        !definitions.has(token) &&
        !definitions.has(token.name)
    ) {
        return construct(token as new (...args: any[]) => T) as T;
    }

    const entry = pickCandidate(token, options?.qualifier);
    const reg = entry.registration;

    if ("useValue" in reg) {
        return reg.useValue as T;
    }

    if (reg.lazy) {
        return createLazyProxy(() => resolveClassBean(token, entry)) as T;
    }

    return resolveClassBean(token, entry) as T;
}

function createLazyProxy(materialize: () => unknown): unknown {
    const ref: DeferredRef = { target: undefined };

    const proxy = new Proxy(function lazy() {}, {
        get(_t, prop) {
            if (!ref.target) ref.target = materialize();
            const value = Reflect.get(ref.target as object, prop, ref.target);
            return typeof value === "function" ? value.bind(ref.target) : value;
        },
        set(_t, prop, value) {
            if (!ref.target) ref.target = materialize();
            (ref.target as Record<string | symbol, unknown>)[prop] = value;
            return true;
        },
        apply(_t, thisArg, args) {
            if (!ref.target) ref.target = materialize();
            return Reflect.apply(ref.target as () => unknown, thisArg ?? ref.target, args);
        },
        getPrototypeOf() {
            return null;
        },
    });

    return proxy;
}

export function resolveAll<T = unknown>(token: Token<T>): T[] {
    return activeEntries(token)
        .sort((a, b) => a.order - b.order)
        .map((entry) => {
            const reg = entry.registration;
            if ("useValue" in reg) return reg.useValue as T;
            return resolveClassBean(token, entry) as T;
        });
}

export function getRegistrationScope(token: Token): BeanScope | undefined {
    const entry = pickCandidate(token);
    return (entry.registration as ClassRegistration).scope;
}

export function inject(token: Token, options?: InjectOptions): ParameterDecorator {
    return (target, _propertyKey, index) => {
        const specs: Record<number, InjectSpec> =
            (Reflect.getMetadata(INJECT_METADATA_KEY, target as object) as Record<number, InjectSpec>) ?? {};
        specs[index] = { token, options };
        Reflect.defineMetadata(INJECT_METADATA_KEY, specs, target as object);
    };
}

export function injectAll(token: Token): ParameterDecorator {
    return (target, _propertyKey, index) => {
        const specs: Record<number, InjectSpec> =
            (Reflect.getMetadata(INJECT_METADATA_KEY, target as object) as Record<number, InjectSpec>) ?? {};
        specs[index] = { token, options: { all: true } };
        Reflect.defineMetadata(INJECT_METADATA_KEY, specs, target as object);
    };
}

function constructorArgs(ctor: new (...args: any[]) => any): unknown[] {
    const explicit: Record<number, InjectSpec> =
        (Reflect.getMetadata(INJECT_METADATA_KEY, ctor) as Record<number, InjectSpec>) ?? {};
    const types: unknown[] = (Reflect.getMetadata("design:paramtypes", ctor) as unknown[]) ?? [];

    const count = Math.max(Object.keys(explicit).length, types.length);
    const args: unknown[] = [];

    for (let i = 0; i < count; i++) {
        const spec = explicit[i];

        if (spec) {
            if (spec.options?.all) {
                args[i] = resolveAll(spec.token);
            } else if (spec.options?.lazy) {
                args[i] = createLazyProxy(() => resolve(spec.token, spec.options));
            } else {
                args[i] = resolve(spec.token, spec.options);
            }
        } else if (typeof types[i] === "function" && types[i] !== Object) {
            args[i] = resolve(types[i] as Token);
        } else {
            args[i] = undefined;
        }
    }

    return args;
}

function construct(ctor: new (...args: any[]) => any): unknown {
    return new ctor(...constructorArgs(ctor));
}

function notifyListeners(token: Token, instance: unknown): void {
    const listeners = resolutionListeners.get(token);
    if (listeners) {
        for (const listener of listeners) {
            listener(token, instance);
        }
    }
    if (typeof token === "function") {
        const namedListeners = resolutionListeners.get(token.name);
        if (namedListeners && namedListeners !== listeners) {
            for (const listener of namedListeners) {
                listener(token.name, instance);
            }
        }
    }
}

function toEntry(registration: Registration, meta: BeanMeta): BeanEntry {
    return {
        name: meta.name ?? (typeof registration === "object" && "useClass" in registration ? registration.useClass.name : ""),
        registration,
        primary: meta.primary ?? false,
        order: meta.order ?? 0,
    };
}

export function registerBean(token: Token, registration: Registration, meta: BeanMeta = {}): void {
    const entries = definitions.get(token) ?? [];
    entries.push(toEntry(registration, meta));
    definitions.set(token, entries);
    ensureFactoryProcessed();
}

export function register(token: Token, registration: Registration): void {
    definitions.set(token, [toEntry(registration, {})]);
    ensureFactoryProcessed();
}

export function afterResolution(token: Token, listener: (token: Token, instance: unknown) => void): void {
    const listeners = resolutionListeners.get(token) ?? [];
    listeners.push(listener);
    resolutionListeners.set(token, listeners);
}

export function registerBeanPostProcessor(processor: BeanPostProcessor): void {
    beanPostProcessors.push(processor);
}

export function registerBeanFactoryPostProcessor(processor: BeanFactoryPostProcessor): void {
    beanFactoryPostProcessors.push(processor);
}

export function runWithRequestContext<T>(fn: () => T, sessionId?: string): T {
    return requestStorage.run({ beans: new Map<BeanEntry, unknown>(), sessionId }, fn);
}

export function clear(): void {
    definitions.clear();
    inCreation.clear();
    pendingProxies.clear();
    sessionBeans.clear();
    beanPostProcessors.length = 0;
    beanFactoryPostProcessors = [];
    factoryProcessed = false;
    resolutionListeners.clear();
}

export const container = {
    register,
    registerBean,
    resolve,
    resolveAll,
    afterResolution,
    registerBeanPostProcessor,
    registerBeanFactoryPostProcessor,
    runWithRequestContext,
    clear,
};
