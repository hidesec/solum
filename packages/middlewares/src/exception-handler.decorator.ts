import "@solumjs/core";
import { registerLifecycleHooks } from "@solumjs/core";

type ExceptionClass = new (...args: any[]) => Error;

interface ExceptionHandlerDefinition {
    exceptionType: ExceptionClass;
    handlerName: string;
}

const EXCEPTION_HANDLERS_METADATA_KEY = "custom:exception-handlers";
const GLOBAL_ADVICE_REGISTRY: (new (...args: any[]) => any)[] = [];

export function ExceptionHandler(exceptionType: ExceptionClass) {
    return function (target: any, propertyKey: string, _descriptor?: PropertyDescriptor) {
        const existing: ExceptionHandlerDefinition[] =
            Reflect.getMetadata(EXCEPTION_HANDLERS_METADATA_KEY, target.constructor) || [];

        existing.push({ exceptionType, handlerName: propertyKey });

        Reflect.defineMetadata(EXCEPTION_HANDLERS_METADATA_KEY, existing, target.constructor);
    };
}

export function ControllerAdvice() {
    return function <T extends new (...args: any[]) => any>(target: T): T {
        registerLifecycleHooks(target, target);
        GLOBAL_ADVICE_REGISTRY.push(target);
        return target;
    };
}

export function getExceptionHandlers(target: Function): ExceptionHandlerDefinition[] {
    return Reflect.getMetadata(EXCEPTION_HANDLERS_METADATA_KEY, target) || [];
}

export function getRegisteredAdvice(): (new (...args: any[]) => any)[] {
    return GLOBAL_ADVICE_REGISTRY;
}

export function findMostSpecificHandler(
    err: Error,
    handlers: ExceptionHandlerDefinition[]
): ExceptionHandlerDefinition | undefined {
    let best: ExceptionHandlerDefinition | undefined;
    let bestDistance = Infinity;

    for (const handler of handlers) {
        if (!(err instanceof handler.exceptionType)) continue;

        const distance = distanceToAncestor(err.constructor, handler.exceptionType);
        if (distance < bestDistance) {
            best = handler;
            bestDistance = distance;
        }
    }

    return best;
}

function distanceToAncestor(from: Function, to: Function): number {
    let current: any = from;
    let depth = 0;

    while (current) {
        if (current === to) return depth;
        current = Object.getPrototypeOf(current);
        depth++;
    }

    return Infinity;
}