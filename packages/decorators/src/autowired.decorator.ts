import "@solumjs/core";
import { container } from "@solumjs/core";

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
                    cache[propertyKey] = container.resolve(token);
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