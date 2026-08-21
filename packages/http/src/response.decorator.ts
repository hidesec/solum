import "@solumjs/core";

const RESPONSE_STATUS_METADATA_KEY = "custom:response-status";

export function ResponseStatus(statusCode: number) {
    return function (target: any, propertyKey: string) {
        const map: Record<string, number> = Reflect.getMetadata(RESPONSE_STATUS_METADATA_KEY, target.constructor) || {};

        map[propertyKey] = statusCode;

        Reflect.defineMetadata(RESPONSE_STATUS_METADATA_KEY, map, target.constructor);
    }
}

export function getResponseStatus(target: Function, handlerName: string, fallback: 200): number {
    const map: Record<string, number> = Reflect.getMetadata(RESPONSE_STATUS_METADATA_KEY, target) || {};
    return map[handlerName] ?? fallback;
}