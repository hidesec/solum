import "@solumjs/core";
import { container } from "@solumjs/core";
import { getFrameworkLogger } from "@solumjs/core";
import { Bean } from "@solumjs/core";
import { isInTransaction } from "@solumjs/orm";
import {
    queueEvent,
    registerEventFlushHook,
} from "./transaction-event-store";
import {
    getTransactionalListeners,
} from "./transactional-event-listener";

const listeners: { eventType: string; target: Function; methodName: string }[] = [];
const ASYNC_METADATA_KEY = "custom:async-event-listeners";

export function EventListener(eventType: string): MethodDecorator {
    return function (target: any, propertyKey: string | symbol, _descriptor?: PropertyDescriptor) {
        listeners.push({
            eventType,
            target: target.constructor ?? target,
            methodName: propertyKey as string,
        });
    };
}

export function Async(): MethodDecorator {
    return function (target: any, propertyKey: string | symbol, _descriptor?: PropertyDescriptor) {
        const destination = target.constructor ?? target;
        const existing: string[] = Reflect.getMetadata(ASYNC_METADATA_KEY, destination) || [];
        existing.push(propertyKey as string);
        Reflect.defineMetadata(ASYNC_METADATA_KEY, existing, destination);
    };
}

function isAsyncListener(target: Function, methodName: string): boolean {
    const asyncMethods: string[] = Reflect.getMetadata(ASYNC_METADATA_KEY, target) || [];
    return asyncMethods.includes(methodName);
}

export interface DomainEvent<T = unknown> {
    type: string;
    payload: T;
    occurredAt: string;
}

export interface IEventBus {
    publish<T>(eventType: string, payload: T): Promise<void>;
}

@Bean("IEventBus")
export class EventBus implements IEventBus {
    private flushRegistered = false;

    async publish<T>(eventType: string, payload: T): Promise<void> {
        const syncListeners = listeners.filter((l) => l.eventType === eventType);
        const txListeners = getTransactionalListeners(eventType);

        const inTx = isInTransaction();
        const hasTxListeners = txListeners.length > 0;

        if (inTx && hasTxListeners) {
            if (!this.flushRegistered) {
                registerEventFlushHook(async (events) => {
                    for (const event of events) {
                        await this.dispatchTransactionalListeners(event.eventType, event.payload);
                    }
                });
                this.flushRegistered = true;
            }

            queueEvent(eventType, payload);

            for (const listener of syncListeners) {
                await this.invokeListener(listener, payload);
            }
            return;
        }

        await Promise.all(
            syncListeners.map(async (listener) => {
                await this.invokeListener(listener, payload);
            })
        );
    }

    private async invokeListener(
        listener: { target: Function; methodName: string },
        payload: unknown
    ): Promise<void> {
        try {
            const instance = container.resolve(listener.target as new (...args: any[]) => any);
            const method = instance[listener.methodName];

            if (isAsyncListener(listener.target, listener.methodName)) {
                setImmediate(() => {
                    method.call(instance, payload).catch((err: unknown) => {
                        getFrameworkLogger().error(
                            { err, listener: `${listener.target.name}.${listener.methodName}` },
                            `Async event listener failed`
                        );
                    });
                });
            } else {
                await method.call(instance, payload);
            }
        } catch (err) {
            getFrameworkLogger().error(
                { err, listener: `${listener.target.name}.${listener.methodName}` },
                `Event listener failed`
            );
        }
    }

    private async dispatchTransactionalListeners(
        eventType: string,
        payload: unknown
    ): Promise<void> {
        const txListeners = getTransactionalListeners(eventType);

        await Promise.all(
            txListeners.map(async (listener) => {
                try {
                    const instance = container.resolve(listener.target as new (...args: any[]) => any);
                    const method = instance[listener.methodName];

                    if (isAsyncListener(listener.target, listener.methodName)) {
                        setImmediate(() => {
                            method.call(instance, payload).catch((err: unknown) => {
                                getFrameworkLogger().error(
                                    { err, listener: `${listener.target.name}.${listener.methodName}` },
                                    `Async transactional event listener failed`
                                );
                            });
                        });
                    } else {
                        await method.call(instance, payload);
                    }
                } catch (err) {
                    getFrameworkLogger().error(
                        { err, listener: `${listener.target.name}.${listener.methodName}` },
                        `Transactional event listener failed`
                    );
                }
            })
        );
    }
}
