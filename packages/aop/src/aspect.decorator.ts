import "@solumjs/core";
import { container } from "@solumjs/core";
import { parsePointcut, ParsedPointcut, resolvePointcut } from "./pointcut";
import {
    ADVICE_METADATA_KEY,
    ASPECT_MARKER_KEY,
    AdviceKind,
    AdviceMeta,
    installAspectAutoProxy,
    registerAspectClass,
} from "./weaver";

export interface JoinPoint {
    target: any;
    className: string;
    methodName: string;
    args: any[];
}

export type MethodInterceptor = (
    joinPoint: JoinPoint,
    proceed: () => Promise<any>
) => Promise<any>;

export type AdviceFn = (joinPoint: JoinPoint, extra?: any) => any;

export function Around(pointcutOrInterceptor: string | MethodInterceptor): MethodDecorator {
    if (typeof pointcutOrInterceptor === "string") {
        return function (target: object, propertyKey: string | symbol) {
            recordAdvice(target, "around", pointcutOrInterceptor, String(propertyKey));
        };
    }
    const interceptor = pointcutOrInterceptor;
    return function (target: any, propertyKey: string | symbol, descriptor: PropertyDescriptor) {
        const originalMethod = descriptor.value;
        const methodName = String(propertyKey);
        const fallbackClassName = target?.constructor?.name ?? target?.name ?? "UnknownClass";

        descriptor.value = function (this: any, ...args: any[]) {
            const className = this?.constructor?.name ?? fallbackClassName;

            const joinPoint: JoinPoint = {
                target: this,
                className,
                methodName,
                args,
            };
            const proceed = () => originalMethod.apply(this, args);

            return interceptor(joinPoint, proceed);
        };

        return descriptor;
    };
}

function recordAdvice(target: object, kind: AdviceKind, expression: string, methodName: string): void {
    parsePointcut(expression);
    const ctor = (target as { constructor?: Function }).constructor ?? target;
    const existing: AdviceMeta[] =
        (Reflect.getMetadata(ADVICE_METADATA_KEY, ctor as object) as AdviceMeta[] | undefined) ?? [];
    existing.push({ kind, expression, methodName });
    Reflect.defineMetadata(ADVICE_METADATA_KEY, existing, ctor as object);
}

function pointcutAdvice(kind: AdviceKind, expression: string): MethodDecorator {
    return function (target: object, propertyKey: string | symbol) {
        recordAdvice(target, kind, expression, String(propertyKey));
    };
}

export function Before(pointcutOrAdvice: string | AdviceFn): MethodDecorator {
    if (typeof pointcutOrAdvice === "string") return pointcutAdvice("before", pointcutOrAdvice);
    return createDirect("before", pointcutOrAdvice);
}

export function After(pointcutOrAdvice: string | AdviceFn): MethodDecorator {
    if (typeof pointcutOrAdvice === "string") return pointcutAdvice("after", pointcutOrAdvice);
    return createDirect("after", pointcutOrAdvice);
}

export function AfterReturning(pointcutOrAdvice: string | AdviceFn): MethodDecorator {
    if (typeof pointcutOrAdvice === "string") return pointcutAdvice("after-returning", pointcutOrAdvice);
    return createDirect("after-returning", pointcutOrAdvice);
}

export function AfterThrowing(pointcutOrAdvice: string | AdviceFn): MethodDecorator {
    if (typeof pointcutOrAdvice === "string") return pointcutAdvice("after-throwing", pointcutOrAdvice);
    return createDirect("after-throwing", pointcutOrAdvice);
}

function createDirect(kind: Exclude<AdviceKind, "around">, advice: AdviceFn): MethodDecorator {
    return function (target: any, propertyKey: string | symbol, descriptor: PropertyDescriptor) {
        const original = descriptor.value;
        const methodName = String(propertyKey);

        descriptor.value = async function (this: any, ...args: any[]) {
            const joinPoint: JoinPoint = {
                target: this,
                className: this?.constructor?.name ?? "UnknownClass",
                methodName,
                args,
            };

            switch (kind) {
                case "before":
                    await advice(joinPoint);
                    return original.apply(this, args);
                case "after":
                    try {
                        return await original.apply(this, args);
                    } finally {
                        await advice(joinPoint);
                    }
                case "after-returning": {
                    const result = await original.apply(this, args);
                    const replaced = await advice(joinPoint, result);
                    return replaced === undefined ? result : replaced;
                }
                case "after-throwing":
                    try {
                        return await original.apply(this, args);
                    } catch (err) {
                        const recovered = await advice(joinPoint, err);
                        if (recovered !== undefined) return recovered;
                        throw err;
                    }
            }
        };

        return descriptor;
    };
}

export function Aspect(): ClassDecorator {
    return (target: any) => {
        const ctor = typeof target === "function" ? target : target.constructor;
        Reflect.defineMetadata(ASPECT_MARKER_KEY, true, ctor);
        registerAspectClass(ctor);
        container.registerBean(String(ctor.name), { useClass: ctor });
        installAspectAutoProxy();
        return target;
    };
}

export type { ParsedPointcut };
