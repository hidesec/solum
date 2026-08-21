type PropertyKey = string | symbol;

declare global {
    namespace Reflect {
        function defineMetadata(key: string, value: unknown, target: object, propertyKey?: string | symbol): void;
        function getOwnMetadata(metadataKey: string, target: object, propertyKey?: string | symbol): any;
        function getMetadata(metadataKey: string, target: object, propertyKey?: string | symbol): any;
        function metadata(metadataKey: string, metadataValue: unknown): (target: object, propertyKey?: string | symbol) => void;
    }
}

interface MetadataStore {
    own: Map<string, unknown>;
    members: Map<PropertyKey, Map<string, unknown>>;
}

const REGISTRY = new WeakMap<object, MetadataStore>();

function storeOf(target: object): MetadataStore {
    let store = REGISTRY.get(target);
    if (!store) {
        store = { own: new Map(), members: new Map() };
        REGISTRY.set(target, store);
    }
    return store;
}

function memberStore(target: object, propertyKey: PropertyKey): Map<string, unknown> {
    const store = storeOf(target);
    let members = store.members.get(propertyKey);
    if (!members) {
        members = new Map();
        store.members.set(propertyKey, members);
    }
    return members;
}

export function defineMetadata(key: string, value: unknown, target: object, propertyKey?: PropertyKey): void {
    if (propertyKey === undefined) {
        storeOf(target).own.set(key, value);
    } else {
        memberStore(target, propertyKey).set(key, value);
    }
}

export function getOwnMetadata(key: string, target: object, propertyKey?: PropertyKey): unknown {
    if (propertyKey === undefined) {
        return storeOf(target).own.get(key);
    }
    return storeOf(target).members.get(propertyKey)?.get(key);
}

function prototypeChain(target: object): object[] {
    const chain: object[] = [];
    let current: object | null = target;
    while (current && current !== Object.prototype) {
        chain.push(current);
        current = Object.getPrototypeOf(current);
    }
    return chain;
}

export function getMetadata(key: string, target: object, propertyKey?: PropertyKey): unknown {
    for (const level of prototypeChain(target)) {
        const value = getOwnMetadata(key, level, propertyKey);
        if (value !== undefined) return value;
    }
    return undefined;
}

export function metadata(key: string, value: unknown): (target: object, propertyKey?: PropertyKey) => void {
    return (target, propertyKey) => defineMetadata(key, value, target, propertyKey);
}

type GlobalReflect = typeof Reflect & {
    defineMetadata?: typeof defineMetadata;
    getOwnMetadata?: typeof getOwnMetadata;
    getMetadata?: typeof getMetadata;
    metadata?: typeof metadata;
};

const globalReflect = globalThis.Reflect as GlobalReflect;

if (typeof globalReflect.defineMetadata !== "function") {
    globalReflect.defineMetadata = defineMetadata;
    globalReflect.getOwnMetadata = getOwnMetadata;
    globalReflect.getMetadata = getMetadata;
    globalReflect.metadata = metadata;
}
