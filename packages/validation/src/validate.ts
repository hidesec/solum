import { getValidationRules, getCascadeTargets, ValidationRule } from "./decorators";

export interface ValidationError {
    property: string;
    constraints: Record<string, string>;
    children?: ValidationError[];
}

export interface ValidateOptions {
    whitelist?: boolean;
    forbidNonWhitelisted?: boolean;
    groups?: string[];
}

function isOptional(rules: ValidationRule[]): boolean {
    return rules.some((rule) => rule.name === "isOptional");
}

function appliesToGroups(rule: ValidationRule, selected: string[] | undefined): boolean {
    if (!rule.groups || rule.groups.length === 0) return true;
    if (!selected || selected.length === 0) return false;
    return rule.groups.some((group) => selected.includes(group));
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
    const cascadeTargets = getCascadeTargets(instance.constructor as Function);
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
        const activeRules = propertyRules.filter((rule) => appliesToGroups(rule, options.groups));

        const value = (instance as Record<string, unknown>)[property];

        if ((value === undefined || value === null) && isOptional(activeRules)) {
            continue;
        }

        for (const rule of activeRules) {
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

    for (const [property, cascadeConfig] of cascadeTargets.entries()) {
        const value = (instance as Record<string, unknown>)[property];
        if (value === null || value === undefined) continue;

        const childOptions: ValidateOptions = {
            ...options,
            groups: cascadeConfig.groups ?? options.groups,
        };

        if (Array.isArray(value)) {
            const children: ValidationError[] = [];
            for (let i = 0; i < value.length; i++) {
                const item = value[i];
                if (item !== null && typeof item === "object" && typeof (item as any).validate === "undefined") {
                    const childErrors = validateInstance(item, childOptions);
                    if (childErrors.length > 0) {
                        children.push({ property: `[${i}]`, constraints: {}, children: childErrors });
                    }
                }
            }
            if (children.length > 0) {
                const existing = errors.find((e) => e.property === property);
                if (existing) {
                    existing.children = children;
                } else {
                    errors.push({ property, constraints: {}, children });
                }
            }
        } else if (typeof value === "object" && typeof (value as any).validate === "undefined") {
            const childErrors = validateInstance(value, childOptions);
            if (childErrors.length > 0) {
                const existing = errors.find((e) => e.property === property);
                if (existing) {
                    existing.children = childErrors;
                } else {
                    errors.push({ property, constraints: {}, children: childErrors });
                }
            }
        }
    }

    return errors;
}
