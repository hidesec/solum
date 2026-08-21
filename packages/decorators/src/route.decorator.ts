import { registerLifecycleHooks } from "./lifecycle.decorator";

export type HttpMethod = "get" | "post" | "put" | "patch" | "delete";

interface RouteDefinition {
    method: HttpMethod;
    path: string;
    handlerName: string;
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

function createMappingDecorator(method: HttpMethod) {
    return function (path: string = "/") {
        return function (target: any, propertyKey: string, _descriptor?: PropertyDescriptor) {
            const existingRoutes: RouteDefinition[] = Reflect.getMetadata(ROUTES_METADATA_KEY, target.constructor) || [];
            existingRoutes.push({ method, path, handlerName: propertyKey });
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