import "@solumjs/core";

export interface ApiPropertyOptions {
    type?: string;
    format?: string;
    description?: string;
    example?: unknown;
    default?: unknown;
    enum?: unknown[];
    minimum?: number;
    maximum?: number;
    minLength?: number;
    maxLength?: number;
    pattern?: string;
    nullable?: boolean;
    readOnly?: boolean;
    writeOnly?: boolean;
    deprecated?: boolean;
}

const API_PROPERTY_METADATA = "custom:api-property";

export function ApiProperty(options: ApiPropertyOptions = {}) {
    return function (target: object, propertyKey: string | symbol) {
        const existing: Map<string, ApiPropertyOptions> =
            Reflect.getMetadata(API_PROPERTY_METADATA, target.constructor) ?? new Map();
        existing.set(String(propertyKey), options);
        Reflect.defineMetadata(API_PROPERTY_METADATA, existing, target.constructor);
    };
}

export function getApiPropertyOptions(target: Function, property: string): ApiPropertyOptions | undefined {
    const map: Map<string, ApiPropertyOptions> | undefined =
        Reflect.getMetadata(API_PROPERTY_METADATA, target) ?? undefined;
    return map?.get(property);
}

export function getAllApiPropertyOptions(target: Function): Map<string, ApiPropertyOptions> {
    return Reflect.getMetadata(API_PROPERTY_METADATA, target) ?? new Map();
}
