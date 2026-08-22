import "@solumjs/core";
import { runWithTransactionSynchronization, registerSynchronization, isInTransaction } from "@solumjs/orm";
import { TransactionalEventListener, getTransactionalListeners, hasTransactionalListeners } from "../transactional-event-listener";
import { queueEvent, getPendingEvents, clearPendingEvents } from "../transaction-event-store";

describe("TransactionalEventListener", () => {
    it("registers transactional listeners", () => {
        class TestHandler {
            @TransactionalEventListener("TEST_EVENT")
            onTestEvent(_payload: unknown) {}
        }

        expect(hasTransactionalListeners("TEST_EVENT")).toBe(true);
        expect(getTransactionalListeners("TEST_EVENT")).toHaveLength(1);
    });

    it("returns empty array for unknown event type", () => {
        expect(getTransactionalListeners("UNKNOWN_EVENT")).toHaveLength(0);
    });
});

describe("TransactionEventStore", () => {
    beforeEach(() => {
        clearPendingEvents();
    });

    it("queues and retrieves events", () => {
        queueEvent("TEST_EVENT", { id: 1 });
        queueEvent("TEST_EVENT", { id: 2 });

        expect(getPendingEvents()).toHaveLength(2);
        expect(getPendingEvents()[0].eventType).toBe("TEST_EVENT");
    });

    it("clears pending events", () => {
        queueEvent("TEST_EVENT", { id: 1 });
        clearPendingEvents();
        expect(getPendingEvents()).toHaveLength(0);
    });
});

describe("TransactionSynchronization", () => {
    it("detects when inside a transaction", async () => {
        expect(isInTransaction()).toBe(false);

        await runWithTransactionSynchronization(async () => {
            expect(isInTransaction()).toBe(true);
        });

        expect(isInTransaction()).toBe(false);
    });

    it("calls afterCommit hooks on successful commit", async () => {
        const afterCommitFn = jest.fn();

        await runWithTransactionSynchronization(async () => {
            registerSynchronization({ afterCommit: afterCommitFn });
            const { runAfterCommitHooks } = await import("@solumjs/orm");
            await runAfterCommitHooks();
        });

        expect(afterCommitFn).toHaveBeenCalled();
    });

    it("calls afterRollback hooks on failure", async () => {
        const afterRollbackFn = jest.fn();

        try {
            await runWithTransactionSynchronization(async () => {
                registerSynchronization({ afterRollback: afterRollbackFn });
                const { runAfterRollbackHooks } = await import("@solumjs/orm");
                runAfterRollbackHooks();
                throw new Error("Transaction failed");
            });
        } catch (_err) {
            // expected
        }

        expect(afterRollbackFn).toHaveBeenCalled();
    });
});
