import "@solumjs/core";

export interface ValidationRule {
    name: string;
    validate: (value: unknown) => boolean;
    message: (propertyName: string) => string;
}

export type ValidationRules = Map<string, ValidationRule[]>;

const RULES_METADATA_KEY = "custom:validation-rules";

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

export function IsOptional(): PropertyDecorator {
    return (target, propertyKey) => {
        addRule(target, propertyKey as string, {
            name: "isOptional",
            validate: () => true,
            message: () => "",
        });
    };
}

export function IsString(): PropertyDecorator {
    return (target, propertyKey) => {
        addRule(target, propertyKey as string, {
            name: "isString",
            validate: (value) => typeof value === "string",
            message: (p) => `${p} must be a string`,
        });
    };
}

export function IsEmail(): PropertyDecorator {
    return (target, propertyKey) => {
        addRule(target, propertyKey as string, {
            name: "isEmail",
            validate: (value) => typeof value === "string" && EMAIL_PATTERN.test(value),
            message: (p) => `${p} must be an email`,
        });
    };
}

export function MinLength(length: number): PropertyDecorator {
    return (target, propertyKey) => {
        addRule(target, propertyKey as string, {
            name: "minLength",
            validate: (value) => typeof value === "string" && value.length >= length,
            message: (p) => `${p} must be longer than or equal to ${length} characters`,
        });
    };
}

export function MaxLength(length: number): PropertyDecorator {
    return (target, propertyKey) => {
        addRule(target, propertyKey as string, {
            name: "maxLength",
            validate: (value) => typeof value === "string" && value.length <= length,
            message: (p) => `${p} must be shorter than or equal to ${length} characters`,
        });
    };
}

export function IsIn(values: readonly string[]): PropertyDecorator {
    return (target, propertyKey) => {
        addRule(target, propertyKey as string, {
            name: "isIn",
            validate: (value) => values.includes(value as string),
            message: (p) => `${p} must be one of the following values: ${values.join(", ")}`,
        });
    };
}

export function IsJWT(): PropertyDecorator {
    return (target, propertyKey) => {
        addRule(target, propertyKey as string, {
            name: "isJwt",
            validate: (value) => typeof value === "string" && JWT_PATTERN.test(value),
            message: (p) => `${p} must be a jwt string`,
        });
    };
}
