import "./reflect-metadata";
import { container, getRegistrationScope } from "./container";

const AUTOWIRED_CACHE_KEY = Symbol("autowired-cache");

export function AutoWired(token: string) {
    return function (target: any, propertyKey: string) {
        Object.defineProperty(target, propertyKey, {
            get(this: any) {
                if (!this[AUTOWIRED_CACHE_KEY]) {
                    Object.defineProperty(this, AUTOWIRED_CACHE_KEY, {
                        value: {},
                        enumerable: false,
                        writable: true,
                    });
                }
                const cache = this[AUTOWIRED_CACHE_KEY];
                if (!(propertyKey in cache)) {
                    let scope: string | undefined;
                    try {
                        scope = getRegistrationScope(token);
                    } catch {
                        scope = undefined;
                    }
                    const value = container.resolve(token);
                    if (!scope || scope === "singleton") {
                        cache[propertyKey] = value;
                        return value;
                    }
                    return value;
                }
                return cache[propertyKey];
            },
            set(this: any, value: unknown) {
                if (!this[AUTOWIRED_CACHE_KEY]) {
                    Object.defineProperty(this, AUTOWIRED_CACHE_KEY, {
                        value: {},
                        enumerable: false,
                        writable: true,
                    });
                }
                this[AUTOWIRED_CACHE_KEY][propertyKey] = value;
            },
            enumerable: true,
            configurable: true,
        });
    };
}
