import crypto from "crypto";
import { getFrameworkLogger } from "../framework-logger";

export interface DomainEvent {
    id: string;
    aggregateId: string;
    aggregateType: string;
    eventType: string;
    data: unknown;
    metadata?: Record<string, unknown>;
    version: number;
    timestamp: number;
}

export interface Snapshot {
    aggregateId: string;
    aggregateType: string;
    state: unknown;
    version: number;
    timestamp: number;
}

export type EventApplier<T> = (state: T, event: DomainEvent) => T;

const eventStore: DomainEvent[] = [];
const snapshots = new Map<string, Snapshot>();
const eventAppliers = new Map<string, EventApplier<any>>();
const eventHandlers = new Map<string, Array<(event: DomainEvent) => void | Promise<void>>>();

export function registerEventApplier(eventType: string, applier: EventApplier<any>): void {
    eventAppliers.set(eventType, applier);
}

export function subscribeToEvents(eventType: string, handler: (event: DomainEvent) => void | Promise<void>): void {
    if (!eventHandlers.has(eventType)) {
        eventHandlers.set(eventType, []);
    }
    eventHandlers.get(eventType)!.push(handler);
}

function generateId(): string {
    return crypto.randomUUID();
}

export class AggregateRoot {
    private _version = 0;
    private _uncommittedEvents: DomainEvent[] = [];

    constructor(
        public readonly id: string,
        public readonly aggregateType: string
    ) {}

    get version(): number {
        return this._version;
    }

    protected apply(eventType: string, data: unknown, metadata?: Record<string, unknown>): void {
        const event: DomainEvent = {
            id: generateId(),
            aggregateId: this.id,
            aggregateType: this.aggregateType,
            eventType,
            data,
            metadata,
            version: this._version + 1,
            timestamp: Date.now(),
        };

        this._uncommittedEvents.push(event);
        this._version = event.version;
    }

    getUncommittedEvents(): DomainEvent[] {
        return [...this._uncommittedEvents];
    }

    markEventsAsCommitted(): void {
        this._uncommittedEvents = [];
    }

    loadFromHistory(events: DomainEvent[]): void {
        for (const event of events) {
            this.applyEvent(event);
        }
    }

    private applyEvent(event: DomainEvent): void {
        const applier = eventAppliers.get(event.eventType);
        if (applier) {
            (this as any)._state = applier((this as any)._state || {}, event);
        }
        this._version = event.version;
    }
}

export async function saveEvents(aggregateId: string, aggregateType: string, events: DomainEvent[]): Promise<void> {
    for (const event of events) {
        eventStore.push(event);
    }

    for (const event of events) {
        const handlers = eventHandlers.get(event.eventType);
        if (handlers) {
            for (const handler of handlers) {
                try {
                    await handler(event);
                } catch (error) {
                    getFrameworkLogger().error(
                        { event: event.eventType, error: (error as Error).message },
                        "Event handler failed"
                    );
                }
            }
        }
    }
}

export function getEvents(aggregateId: string): DomainEvent[] {
    return eventStore.filter((e) => e.aggregateId === aggregateId);
}

export function getEventsByType(eventType: string): DomainEvent[] {
    return eventStore.filter((e) => e.eventType === eventType);
}

export function getAllEvents(): DomainEvent[] {
    return [...eventStore];
}

export function getEventsAfterVersion(aggregateId: string, version: number): DomainEvent[] {
    return eventStore.filter((e) => e.aggregateId === aggregateId && e.version > version);
}

export function saveSnapshot(aggregateId: string, aggregateType: string, state: unknown, version: number): void {
    snapshots.set(aggregateId, {
        aggregateId,
        aggregateType,
        state,
        version,
        timestamp: Date.now(),
    });
}

export function getSnapshot(aggregateId: string): Snapshot | undefined {
    return snapshots.get(aggregateId);
}

export function loadAggregate<T extends AggregateRoot>(
    aggregateId: string,
    aggregateType: string,
    factory: (id: string) => T
): T {
    const aggregate = factory(aggregateId);

    const snapshot = getSnapshot(aggregateId);
    if (snapshot) {
        (aggregate as any)._state = snapshot.state;
        (aggregate as any)._version = snapshot.version;
    }

    const fromVersion = snapshot?.version || 0;
    const events = getEventsAfterVersion(aggregateId, fromVersion);
    aggregate.loadFromHistory(events);

    return aggregate;
}

export function clearEventStore(): void {
    eventStore.length = 0;
    snapshots.clear();
    eventHandlers.clear();
}

export function replayEvents(
    aggregateId: string,
    fromVersion: number = 0,
    toVersion?: number
): DomainEvent[] {
    return eventStore.filter(
        (e) =>
            e.aggregateId === aggregateId &&
            e.version > fromVersion &&
            (toVersion === undefined || e.version <= toVersion)
    );
}
