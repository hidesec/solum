import { isInTransaction, registerSynchronization } from "@solumjs/orm";

export interface QueuedEvent {
    eventType: string;
    payload: unknown;
}

const pendingEvents: QueuedEvent[] = [];

export function queueEvent(eventType: string, payload: unknown): void {
    pendingEvents.push({ eventType, payload });
}

export function getPendingEvents(): QueuedEvent[] {
    return pendingEvents;
}

export function clearPendingEvents(): void {
    pendingEvents.length = 0;
}

export function registerEventFlushHook(flushFn: (events: QueuedEvent[]) => Promise<void>): void {
    if (!isInTransaction()) return;

    registerSynchronization({
        afterCommit: async () => {
            const events = [...pendingEvents];
            clearPendingEvents();
            await flushFn(events);
        },
        afterRollback: () => {
            clearPendingEvents();
        },
    });
}

export { isInTransaction };
