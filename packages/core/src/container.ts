import "./reflect-metadata";

export type Token<T = unknown> = string | (new (...args: any[]) => T);

export interface ClassRegistration {
    useClass: new (...args: any[]) => any;
    when?: () => boolean;
}

export interface ValueRegistration {
    useValue: unknown;
}

export type Registration = ClassRegistration | ValueRegistration;

type ResolutionListener = (token: Token, instance: unknown) => void;

const INJECT_METADATA_KEY = "custom:inject-tokens";
const registrations = new Map<Token, Registration>();
const resolutionListeners = new Map<Token, ResolutionListener[]>();

export function inject(token: Token): ParameterDecorator {
    return (target, _propertyKey, index) => {
        const tokens: Record<number, Token> =
            (Reflect.getMetadata(INJECT_METADATA_KEY, target as object) as Record<number, Token>) ?? {};
        tokens[index] = token;
        Reflect.defineMetadata(INJECT_METADATA_KEY, tokens, target as object);
    };
}

function constructorArgs(ctor: new (...args: any[]) => any): unknown[] {
    const explicit = (Reflect.getMetadata(INJECT_METADATA_KEY, ctor) as Record<number, Token>) ?? {};
    const types: unknown[] = (Reflect.getMetadata("design:paramtypes", ctor) as unknown[]) ?? [];

    const count = Math.max(Object.keys(explicit).length, types.length);
    const args: unknown[] = [];

    for (let i = 0; i < count; i++) {
        if (explicit[i] !== undefined) {
            args[i] = resolve(explicit[i]);
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
    if (!listeners) return;
    for (const listener of listeners) {
        listener(token, instance);
    }
}

export function resolve<T = unknown>(token: Token<T>): T {
    const registration = registrations.get(token);

    let instance: unknown;

    if (!registration) {
        if (typeof token === "function") {
            instance = construct(token as new (...args: any[]) => any);
        } else {
            throw new Error(`Attempted to resolve unregistered dependency token: "${String(token)}"`);
        }
    } else if ("useValue" in registration) {
        instance = registration.useValue;
    } else {
        if (registration.when && !registration.when()) {
            throw new Error(
                `Bean "${String(token)}" is not available in the active environment. ` +
                `Its @Profile condition evaluated to false.`
            );
        }
        instance = construct(registration.useClass);
    }

    notifyListeners(token, instance);
    return instance as T;
}

export function register(token: Token, registration: Registration): void {
    registrations.set(token, registration);
}

export function afterResolution(token: Token, listener: ResolutionListener): void {
    const listeners = resolutionListeners.get(token) ?? [];
    listeners.push(listener);
    resolutionListeners.set(token, listeners);
}

export function clear(): void {
    registrations.clear();
    resolutionListeners.clear();
}

export const container = { register, resolve, afterResolution, clear };
