import "@solumjs/core";
import { container } from "@solumjs/core";
import { Bean } from "@solumjs/core";
import {
    runWithTransactionSynchronization,
    registerDatabaseDriver,
    runAfterCommitHooks,
} from "@solumjs/orm";
import { EventListener, EventBus, Async } from "../event-bus";
import { TransactionalEventListener } from "../transactional-event-listener";
import { clearPendingEvents } from "../transaction-event-store";

const receivedEvents: { type: string; payload: unknown }[] = [];

@Bean()
class TestListener {
    @EventListener("SYNC_EVENT")
    async onSyncEvent(payload: unknown): Promise<void> {
        receivedEvents.push({ type: "SYNC_EVENT", payload });
    }

    @TransactionalEventListener("TX_EVENT")
    async onTxEvent(payload: unknown): Promise<void> {
        receivedEvents.push({ type: "TX_EVENT", payload });
    }

    @EventListener("ASYNC_EVENT")
    @Async()
    async onAsyncEvent(payload: unknown): Promise<void> {
        receivedEvents.push({ type: "ASYNC_EVENT", payload });
    }
}

function createMockDriver() {
    return {
        clientName: "sqlite" as const,
        query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
        connect: jest.fn(),
        close: jest.fn(),
        transaction: jest.fn().mockImplementation(async (fn: Function) => fn({})),
    };
}

describe("EventBus", () => {
    let bus: EventBus;

    beforeEach(() => {
        receivedEvents.length = 0;
        clearPendingEvents();
        bus = new EventBus();
    });

    it("dispatches sync events immediately", async () => {
        await bus.publish("SYNC_EVENT", { id: 1 });
        expect(receivedEvents).toHaveLength(1);
        expect(receivedEvents[0].type).toBe("SYNC_EVENT");
    });

    it("queues transactional events and flushes after commit", async () => {
        const driver = createMockDriver();
        registerDatabaseDriver(driver as any);

        await runWithTransactionSynchronization(async () => {
            await bus.publish("TX_EVENT", { id: 1 });

            expect(receivedEvents).toHaveLength(0);

            await runAfterCommitHooks();
        });

        expect(receivedEvents).toHaveLength(1);
        expect(receivedEvents[0].type).toBe("TX_EVENT");
        expect(receivedEvents[0].payload).toEqual({ id: 1 });
    });

    it("discards transactional events on rollback", async () => {
        const driver = createMockDriver();
        registerDatabaseDriver(driver as any);

        try {
            await runWithTransactionSynchronization(async () => {
                await bus.publish("TX_EVENT", { id: 1 });
                const { runAfterRollbackHooks } = await import("@solumjs/orm");
                runAfterRollbackHooks();
                throw new Error("Transaction failed");
            });
        } catch (_err) {}

        expect(receivedEvents).toHaveLength(0);
    });

    it("does not queue non-transactional events during transaction", async () => {
        const driver = createMockDriver();
        registerDatabaseDriver(driver as any);

        await runWithTransactionSynchronization(async () => {
            await bus.publish("SYNC_EVENT", { id: 1 });
            expect(receivedEvents).toHaveLength(1);
        });
    });

    it("dispatches async events via setImmediate", async () => {
        await bus.publish("ASYNC_EVENT", { id: 1 });

        expect(receivedEvents).toHaveLength(0);

        await new Promise((resolve) => setImmediate(resolve));

        expect(receivedEvents).toHaveLength(1);
        expect(receivedEvents[0].type).toBe("ASYNC_EVENT");
    });
});
