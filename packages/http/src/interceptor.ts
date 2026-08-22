import "@solumjs/core";
import { container } from "@solumjs/core";
import { SolumjsRequest, SolumjsResponse } from "./http-types";
import { matchPathPattern } from "./path-match";

export interface ExecutionContextLike {
    classRef?: Function;
    handlerName?: string;
    request: SolumjsRequest;
    response: SolumjsResponse;
}

export interface HandlerInterceptor {
    preHandle?(request: SolumjsRequest, response: SolumjsResponse): boolean | Promise<boolean>;
    postHandle?(request: SolumjsRequest, response: SolumjsResponse): void | Promise<void>;
    afterCompletion?(request: SolumjsRequest, response: SolumjsResponse, error?: unknown): void | Promise<void>;
}

export type InterceptorClass = new (...args: any[]) => HandlerInterceptor;

export interface InterceptorRegistrationOptions {
    patterns?: string[];
    excludePatterns?: string[];
    methods?: string[];
}

interface InterceptorEntry {
    interceptor: HandlerInterceptor;
    patterns: string[];
    excludePatterns: string[];
    methods?: string[];
}

const registry: InterceptorEntry[] = [];

export function addInterceptors(
    interceptorOrClass: HandlerInterceptor | InterceptorClass,
    options: InterceptorRegistrationOptions = {}
): void {
    const interceptor =
        typeof interceptorOrClass === "function" ? container.resolve(interceptorOrClass) : interceptorOrClass;

    registry.push({
        interceptor,
        patterns: options.patterns ?? [],
        excludePatterns: options.excludePatterns ?? [],
        methods: options.methods?.map((m) => m.toUpperCase()),
    });
}

export function resetInterceptors(): void {
    registry.length = 0;
}

export function resolveInterceptors(method: string, path: string): HandlerInterceptor[] {
    return registry
        .filter((entry) => {
            if (entry.methods && !entry.methods.includes(method.toUpperCase())) return false;
            if (entry.excludePatterns.some((p) => matchPathPattern(p, path))) return false;
            if (entry.patterns.length === 0) return true;
            return entry.patterns.some((p) => matchPathPattern(p, path));
        })
        .map((entry) => entry.interceptor);
}

const HANDLER_INTERCEPTORS_KEY = "custom:use-interceptors";
const CONTROLLER_INTERCEPTORS_KEY = "custom:controller-interceptors";

export function UseInterceptors(...interceptors: (HandlerInterceptor | InterceptorClass)[]): MethodDecorator &
    ClassDecorator {
    return function (target: any, propertyKey?: string | symbol, _descriptor?: PropertyDescriptor) {
        if (propertyKey === undefined) {
            const existing: (HandlerInterceptor | InterceptorClass)[] =
                Reflect.getMetadata(CONTROLLER_INTERCEPTORS_KEY, target) ?? [];
            Reflect.defineMetadata(CONTROLLER_INTERCEPTORS_KEY, [...existing, ...interceptors], target);
            return target;
        }
        const destination = target.constructor ?? target;
        const existing: (HandlerInterceptor | InterceptorClass)[] =
            Reflect.getMetadata(HANDLER_INTERCEPTORS_KEY, destination) ?? [];
        existing.push(...interceptors);
        Reflect.defineMetadata(HANDLER_INTERCEPTORS_KEY, existing, destination);
    };
}

function materialize(interceptor: HandlerInterceptor | InterceptorClass): HandlerInterceptor {
    return typeof interceptor === "function" ? container.resolve(interceptor) : interceptor;
}

export function getControllerInterceptors(target: Function): HandlerInterceptor[] {
    const list = (Reflect.getMetadata(CONTROLLER_INTERCEPTORS_KEY, target) ?? []) as (
        | HandlerInterceptor
        | InterceptorClass
    )[];
    return list.map(materialize);
}

export function getHandlerInterceptors(target: Function, handlerName: string): HandlerInterceptor[] {
    const list = (Reflect.getMetadata(HANDLER_INTERCEPTORS_KEY, target, handlerName) ?? []) as (
        | HandlerInterceptor
        | InterceptorClass
    )[];
    return list.map(materialize);
}
