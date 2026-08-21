import "@solumjs/core";
import { container } from "@solumjs/core";
import { ForbiddenException } from "@solumjs/core";
import { SolumjsRequest, SolumjsResponse } from "./http-types";

export interface ExecutionContext {
    classRef: Function;
    handlerName: string;
    request: SolumjsRequest;
    response: SolumjsResponse;
}

export interface CanActivate {
    canActivate(context: ExecutionContext): boolean | Promise<boolean>;
}

export type GuardClass = new (...args: any[]) => CanActivate;

const CLASS_GUARDS_METADATA_KEY = "custom:class-guards";
const HANDLER_GUARDS_METADATA_KEY = "custom:handler-guards";

export function UseGuards(...guards: GuardClass[]): ClassDecorator & MethodDecorator {
    return function (target: any, propertyKey?: string | symbol, _descriptor?: PropertyDescriptor) {
        if (propertyKey === undefined) {
            const existing: GuardClass[] = Reflect.getMetadata(CLASS_GUARDS_METADATA_KEY, target) || [];
            Reflect.defineMetadata(CLASS_GUARDS_METADATA_KEY, [...existing, ...guards], target);
            return target;
        }

        const destination = target.constructor ?? target;
        const existing: GuardClass[] = Reflect.getMetadata(HANDLER_GUARDS_METADATA_KEY, destination, propertyKey as string) || [];
        Reflect.defineMetadata(HANDLER_GUARDS_METADATA_KEY, [...existing, ...guards], destination, propertyKey as string);
        return target;
    };
}

const ROLES_METADATA_KEY = "custom:roles";

export function Roles(...roles: string[]): MethodDecorator {
    return function (target: any, propertyKey: string | symbol, _descriptor?: PropertyDescriptor) {
        const destination = target.constructor ?? target;
        Reflect.defineMetadata(ROLES_METADATA_KEY, roles, destination, propertyKey as string);
    };
}

export function getClassGuards(target: Function): GuardClass[] {
    return Reflect.getMetadata(CLASS_GUARDS_METADATA_KEY, target) || [];
}

export function getHandlerGuards(target: Function, handlerName: string): GuardClass[] {
    return Reflect.getMetadata(HANDLER_GUARDS_METADATA_KEY, target, handlerName) || [];
}

export function getRequiredRoles(target: Function, handlerName: string): string[] {
    return Reflect.getMetadata(ROLES_METADATA_KEY, target, handlerName) || [];
}

export async function runGuards(guards: GuardClass[], context: ExecutionContext): Promise<void> {
    for (const guardClass of guards) {
        const guard = container.resolve(guardClass);
        const allowed = await guard.canActivate(context);
        if (!allowed) {
            throw new ForbiddenException(`Access denied by ${guardClass.name}`);
        }
    }
}
