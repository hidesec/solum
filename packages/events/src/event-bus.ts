import "@solumjs/core";
import { container } from "@solumjs/core";
import { getFrameworkLogger } from "@solumjs/core";
import { Bean } from "@solumjs/core";

const listeners: { eventType: string; target: Function; methodName: string }[] = [];

export function EventListener(eventType: string): MethodDecorator {
    return function (target: any, propertyKey: string | symbol, _descriptor?: PropertyDescriptor) {
        listeners.push({
            eventType,
            target: target.constructor ?? target,
            methodName: propertyKey as string,
        });
    };
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
    async publish<T>(eventType: string, payload: T): Promise<void> {
        const matched = listeners.filter((l) => l.eventType === eventType);

        await Promise.all(
            matched.map(async (listener) => {
                try {
                    const instance = container.resolve(listener.target as new (...args: any[]) => any);
                    await instance[listener.methodName](payload);
                } catch (err) {
                    getFrameworkLogger().error(
                        { err, eventType, listener: `${listener.target.name}.${listener.methodName}` },
                        `Event listener failed for "${eventType}"`
                    );
                }
            })
        );
    }
}
