import { getValidationRules, ValidationRule } from "./decorators";

export interface ValidationError {
    property: string;
    constraints: Record<string, string>;
}

export interface ValidateOptions {
    whitelist?: boolean;
    forbidNonWhitelisted?: boolean;
}

function isOptional(rules: ValidationRule[]): boolean {
    return rules.some((rule) => rule.name === "isOptional");
}

export function toInstance<T extends object>(ctor: new (...args: any[]) => T, plain: unknown): T {
    const instance = Object.create(ctor.prototype) as T;

    if (plain !== null && typeof plain === "object") {
        for (const [key, value] of Object.entries(plain)) {
            (instance as Record<string, unknown>)[key] = value;
        }
    }

    return instance;
}

export function validateInstance(
    instance: object,
    options: ValidateOptions = {}
): ValidationError[] {
    const errors: ValidationError[] = [];
    const rules = getValidationRules(instance.constructor as Function);
    const ownKeys = new Set(Object.keys(instance));

    if (options.whitelist || options.forbidNonWhitelisted) {
        for (const key of ownKeys) {
            if (!rules.has(key)) {
                if (options.forbidNonWhitelisted) {
                    errors.push({
                        property: key,
                        constraints: { whitelistValidation: `property ${key} should not exist` },
                    });
                } else if (options.whitelist) {
                    delete (instance as Record<string, unknown>)[key];
                }
            }
        }
    }

    for (const [property, propertyRules] of rules.entries()) {
        const value = (instance as Record<string, unknown>)[property];

        if ((value === undefined || value === null) && isOptional(propertyRules)) {
            continue;
        }

        for (const rule of propertyRules) {
            if (rule.name === "isOptional") continue;

            if (!rule.validate(value)) {
                const existing = errors.find((e) => e.property === property);
                const constraint = { [rule.name]: rule.message(property) };

                if (existing) {
                    existing.constraints[rule.name] = rule.message(property);
                } else {
                    errors.push({ property, constraints: constraint });
                }
            }
        }
    }

    return errors;
}
