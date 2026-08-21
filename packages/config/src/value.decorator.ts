import "@solumjs/core";
import { getFrameworkConfig } from "@solumjs/core";

interface ValueKey {
    key: string;
    defaultValue?: string;
}

function parseValueKey(raw: string): ValueKey {
    const placeholder = /^\$\{([^:$}]+)(?::(.*))?\}$/.exec(raw.trim());
    if (placeholder) {
        return { key: placeholder[1], defaultValue: placeholder[2] };
    }
    return { key: raw };
}

function coerceValue(value: string, fieldType: unknown): unknown {
    if (fieldType === Number) {
        const parsed = Number(value);
        return Number.isNaN(parsed) ? value : parsed;
    }
    if (fieldType === Boolean) {
        return ["1", "true", "yes", "on"].includes(value.toLowerCase());
    }
    return value;
}

export function Value(rawKey: string): PropertyDecorator {
    return function (target: object, propertyKey: string | symbol) {
        Object.defineProperty(target, propertyKey, {
            get(this: any) {
                const { key, defaultValue } = parseValueKey(rawKey);
                const raw = getFrameworkConfig().get(key);

                if (raw !== undefined && raw !== "") {
                    const fieldType = Reflect.getMetadata("design:type", target, propertyKey);
                    return coerceValue(raw, fieldType);
                }

                if (defaultValue !== undefined) {
                    const fieldType = Reflect.getMetadata("design:type", target, propertyKey);
                    return coerceValue(defaultValue, fieldType);
                }

                throw new Error(
                    `@Value("${rawKey}") could not be resolved: config key "${key}" is not set and no default was provided.`
                );
            },
            enumerable: true,
            configurable: true,
        });
    };
}
