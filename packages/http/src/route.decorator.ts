import { registerLifecycleHooks } from "@solumjs/core";

export type HttpMethod = "get" | "post" | "put" | "patch" | "delete";

interface RouteDefinition {
    method: HttpMethod;
    path: string;
    handlerName: string;
    produces?: string[];
    consumes?: string[];
}

interface ControllerRegistration {
    target: new (...args: any[]) => any;
    prefix: string;
}

const ROUTES_METADATA_KEY = "custom:routes";
const CONTROLLERS: ControllerRegistration[] = [];

export function RestController(prefix: string = "/") {
    return function <T extends new (...args: any[]) => any>(target: T): T {
        registerLifecycleHooks(target, target);
        CONTROLLERS.push({ target, prefix });
        return target;
    };
}

export interface MappingOptions {
    path?: string;
    produces?: string[];
    consumes?: string[];
}

function createMappingDecorator(method: HttpMethod) {
    return function (pathOrOptions: string | MappingOptions = "/") {
        return function (target: any, propertyKey: string, _descriptor?: PropertyDescriptor) {
            const existingRoutes: RouteDefinition[] = Reflect.getMetadata(ROUTES_METADATA_KEY, target.constructor) || [];
            let path = "/";
            let produces: string[] | undefined;
            let consumes: string[] | undefined;

            if (typeof pathOrOptions === "string") {
                path = pathOrOptions;
            } else {
                path = pathOrOptions.path || "/";
                produces = pathOrOptions.produces;
                consumes = pathOrOptions.consumes;
            }

            existingRoutes.push({ method, path, handlerName: propertyKey, produces, consumes });
            Reflect.defineMetadata(ROUTES_METADATA_KEY, existingRoutes, target.constructor);
        }
    }
}

export const Get = createMappingDecorator("get");
export const Post = createMappingDecorator("post");
export const Put = createMappingDecorator("put");
export const Patch = createMappingDecorator("patch");
export const Delete = createMappingDecorator("delete");

export function getRoutesMetadata(target: Function): RouteDefinition[] {
    return Reflect.getMetadata(ROUTES_METADATA_KEY, target) || [];
}

export function getRegisteredControllers(): ControllerRegistration[] {
    return CONTROLLERS;
}