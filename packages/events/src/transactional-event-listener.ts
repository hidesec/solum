import "@solumjs/core";

const TRANSACTIONAL_LISTENERS_KEY = "custom:transactional-event-listeners";

export interface TransactionalListenerDefinition {
    eventType: string;
    target: Function;
    methodName: string;
}

const transactionalListeners: TransactionalListenerDefinition[] = [];

export function TransactionalEventListener(eventType: string): MethodDecorator {
    return function (target: any, propertyKey: string | symbol, _descriptor?: PropertyDescriptor) {
        const entry: TransactionalListenerDefinition = {
            eventType,
            target: target.constructor ?? target,
            methodName: propertyKey as string,
        };

        transactionalListeners.push(entry);

        const existing: TransactionalListenerDefinition[] =
            Reflect.getMetadata(TRANSACTIONAL_LISTENERS_KEY, target.constructor ?? target) || [];
        existing.push(entry);
        Reflect.defineMetadata(TRANSACTIONAL_LISTENERS_KEY, existing, target.constructor ?? target);
    };
}

export function getTransactionalListeners(eventType: string): TransactionalListenerDefinition[] {
    return transactionalListeners.filter((l) => l.eventType === eventType);
}

export function hasTransactionalListeners(eventType: string): boolean {
    return transactionalListeners.some((l) => l.eventType === eventType);
}

export function getTransactionalListenersForTarget(target: Function): TransactionalListenerDefinition[] {
    return Reflect.getMetadata(TRANSACTIONAL_LISTENERS_KEY, target) || [];
}
