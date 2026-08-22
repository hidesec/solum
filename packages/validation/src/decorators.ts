import "@solumjs/core";

export interface ValidationRule {
    name: string;
    validate: (value: unknown) => boolean;
    message: (propertyName: string) => string;
    groups?: string[];
    params?: Record<string, unknown>;
}

export type ValidationRules = Map<string, ValidationRule[]>;

const RULES_METADATA_KEY = "custom:validation-rules";

export interface RuleOptions {
    groups?: string[];
}

function addRule(target: object, propertyKey: string, rule: ValidationRule): void {
    const existing = Reflect.getOwnMetadata(RULES_METADATA_KEY, target.constructor ?? target) as
        | ValidationRules
        | undefined;

    const rules: ValidationRules = existing ?? new Map();

    if (!rules.has(propertyKey)) {
        rules.set(propertyKey, []);
    }

    rules.get(propertyKey)!.push(rule);
    Reflect.defineMetadata(RULES_METADATA_KEY, rules, target.constructor ?? target);
}

export function getValidationRules(target: Function): ValidationRules {
    return (Reflect.getOwnMetadata(RULES_METADATA_KEY, target) as ValidationRules | undefined) ?? new Map();
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const JWT_PATTERN = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*$/;

export function IsOptional(options?: RuleOptions): PropertyDecorator {
    return (target, propertyKey) => {
        addRule(target, propertyKey as string, {
            name: "isOptional",
            validate: () => true,
            message: () => "",
            groups: options?.groups,
        });
    };
}

export function IsString(options?: RuleOptions): PropertyDecorator {
    return (target, propertyKey) => {
        addRule(target, propertyKey as string, {
            name: "isString",
            validate: (value) => typeof value === "string",
            message: (p) => `${p} must be a string`,
            groups: options?.groups,
        });
    };
}

export function IsEmail(options?: RuleOptions): PropertyDecorator {
    return (target, propertyKey) => {
        addRule(target, propertyKey as string, {
            name: "isEmail",
            validate: (value) => typeof value === "string" && EMAIL_PATTERN.test(value),
            message: (p) => `${p} must be an email`,
            groups: options?.groups,
        });
    };
}

export function MinLength(length: number, options?: RuleOptions): PropertyDecorator {
    return (target, propertyKey) => {
        addRule(target, propertyKey as string, {
            name: "minLength",
            validate: (value) => typeof value === "string" && value.length >= length,
            message: (p) => `${p} must be longer than or equal to ${length} characters`,
            groups: options?.groups,
            params: { value: length },
        });
    };
}

export function MaxLength(length: number, options?: RuleOptions): PropertyDecorator {
    return (target, propertyKey) => {
        addRule(target, propertyKey as string, {
            name: "maxLength",
            validate: (value) => typeof value === "string" && value.length <= length,
            message: (p) => `${p} must be shorter than or equal to ${length} characters`,
            groups: options?.groups,
            params: { value: length },
        });
    };
}

export function IsIn(values: readonly string[], options?: RuleOptions): PropertyDecorator {
    return (target, propertyKey) => {
        addRule(target, propertyKey as string, {
            name: "isIn",
            validate: (value) => values.includes(value as string),
            message: (p) => `${p} must be one of the following values: ${values.join(", ")}`,
            groups: options?.groups,
            params: { values: [...values] },
        });
    };
}

export function IsJWT(options?: RuleOptions): PropertyDecorator {
    return (target, propertyKey) => {
        addRule(target, propertyKey as string, {
            name: "isJwt",
            validate: (value) => typeof value === "string" && JWT_PATTERN.test(value),
            message: (p) => `${p} must be a jwt string`,
            groups: options?.groups,
        });
    };
}

export function Size(min: number, max: number, options?: RuleOptions): PropertyDecorator {
    return (target, propertyKey) => {
        addRule(target, propertyKey as string, {
            name: "size",
            validate: (value) =>
                (typeof value === "string" || Array.isArray(value)) &&
                value.length >= min &&
                value.length <= max,
            message: (p) => `${p} size must be between ${min} and ${max}`,
            groups: options?.groups,
            params: { min, max },
        });
    };
}

export function Pattern(regex: RegExp | string, options?: RuleOptions & { flags?: string }): PropertyDecorator {
    const compiled = typeof regex === "string" ? new RegExp(regex, options?.flags) : regex;
    return (target, propertyKey) => {
        addRule(target, propertyKey as string, {
            name: "pattern",
            validate: (value) => typeof value === "string" && compiled.test(value),
            message: (p) => `${p} must match "${compiled.source}"`,
            groups: options?.groups,
            params: { pattern: compiled.source },
        });
    };
}

export function Min(bound: number, options?: RuleOptions): PropertyDecorator {
    return (target, propertyKey) => {
        addRule(target, propertyKey as string, {
            name: "min",
            validate: (value) => typeof value === "number" && Number.isFinite(value) && value >= bound,
            message: (p) => `${p} must be greater than or equal to ${bound}`,
            groups: options?.groups,
            params: { value: bound },
        });
    };
}

export function Max(bound: number, options?: RuleOptions): PropertyDecorator {
    return (target, propertyKey) => {
        addRule(target, propertyKey as string, {
            name: "max",
            validate: (value) => typeof value === "number" && Number.isFinite(value) && value <= bound,
            message: (p) => `${p} must be less than or equal to ${bound}`,
            groups: options?.groups,
            params: { value: bound },
        });
    };
}

export function IsNumber(options?: RuleOptions): PropertyDecorator {
    return (target, propertyKey) => {
        addRule(target, propertyKey as string, {
            name: "isNumber",
            validate: (value) => typeof value === "number" && Number.isFinite(value),
            message: (p) => `${p} must be a number`,
            groups: options?.groups,
        });
    };
}

export function IsInt(options?: RuleOptions): PropertyDecorator {
    return (target, propertyKey) => {
        addRule(target, propertyKey as string, {
            name: "isInt",
            validate: (value) => typeof value === "number" && Number.isInteger(value),
            message: (p) => `${p} must be an integer`,
            groups: options?.groups,
        });
    };
}

export function IsBoolean(options?: RuleOptions): PropertyDecorator {
    return (target, propertyKey) => {
        addRule(target, propertyKey as string, {
            name: "isBoolean",
            validate: (value) => typeof value === "boolean",
            message: (p) => `${p} must be a boolean`,
            groups: options?.groups,
        });
    };
}

export function NotEmpty(options?: RuleOptions): PropertyDecorator {
    return (target, propertyKey) => {
        addRule(target, propertyKey as string, {
            name: "notEmpty",
            validate: (value) =>
                (typeof value === "string" || Array.isArray(value)) && value.length > 0,
            message: (p) => `${p} must not be empty`,
            groups: options?.groups,
        });
    };
}

export function NotBlank(options?: RuleOptions): PropertyDecorator {
    return (target, propertyKey) => {
        addRule(target, propertyKey as string, {
            name: "notBlank",
            validate: (value) => typeof value === "string" && value.trim().length > 0,
            message: (p) => `${p} must not be blank`,
            groups: options?.groups,
        });
    };
}

export function IsArray(options?: RuleOptions): PropertyDecorator {
    return (target, propertyKey) => {
        addRule(target, propertyKey as string, {
            name: "isArray",
            validate: (value) => Array.isArray(value),
            message: (p) => `${p} must be an array`,
            groups: options?.groups,
        });
    };
}

export function IsUUID(options?: RuleOptions): PropertyDecorator {
    const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return (target, propertyKey) => {
        addRule(target, propertyKey as string, {
            name: "isUuid",
            validate: (value) => typeof value === "string" && UUID_PATTERN.test(value),
            message: (p) => `${p} must be a UUID`,
            groups: options?.groups,
        });
    };
}
