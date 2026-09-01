import {
    runWithTransactionSynchronization,
    registerSynchronization,
    runAfterCommitHooks,
    runAfterRollbackHooks,
    isInTransaction,
} from "../transaction-synchronization";

describe("transaction-synchronization", () => {
    it("isInTransaction returns false outside transaction", () => {
        expect(isInTransaction()).toBe(false);
    });

    it("isInTransaction returns true inside transaction context", async () => {
        await runWithTransactionSynchronization(async () => {
            expect(isInTransaction()).toBe(true);
        });
    });

    it("isInTransaction returns false after transaction context exits", async () => {
        await runWithTransactionSynchronization(async () => {
            expect(isInTransaction()).toBe(true);
        });
        expect(isInTransaction()).toBe(false);
    });

    it("runAfterCommitHooks runs all registered hooks", async () => {
        const calls: string[] = [];
        await runWithTransactionSynchronization(async () => {
            registerSynchronization({ afterCommit: async () => { calls.push("a"); } });
            registerSynchronization({ afterCommit: async () => { calls.push("b"); } });
            await runAfterCommitHooks();
        });
        expect(calls).toEqual(["a", "b"]);
    });

    it("runAfterCommitHooks does nothing outside transaction", async () => {
        await expect(runAfterCommitHooks()).resolves.toBeUndefined();
    });

    it("runAfterRollbackHooks runs all registered hooks", async () => {
        const calls: string[] = [];
        await runWithTransactionSynchronization(async () => {
            registerSynchronization({ afterRollback: () => { calls.push("rb-a"); } });
            registerSynchronization({ afterRollback: () => { calls.push("rb-b"); } });
            runAfterRollbackHooks();
        });
        expect(calls).toEqual(["rb-a", "rb-b"]);
    });

    it("runAfterRollbackHooks does nothing outside transaction", () => {
        expect(() => runAfterRollbackHooks()).not.toThrow();
    });

    it("runAfterRollbackHooks catches errors in hooks", async () => {
        await runWithTransactionSynchronization(async () => {
            registerSynchronization({ afterRollback: () => { throw new Error("fail"); } });
            expect(() => runAfterRollbackHooks()).not.toThrow();
        });
    });

    it("hooks can be async", async () => {
        const calls: string[] = [];
        await runWithTransactionSynchronization(async () => {
            registerSynchronization({
                afterCommit: async () => {
                    await new Promise((r) => setTimeout(r, 5));
                    calls.push("async-a");
                },
            });
            await runAfterCommitHooks();
        });
        expect(calls).toEqual(["async-a"]);
    });

    it("nested transactions have independent contexts", async () => {
        const outer: string[] = [];
        const inner: string[] = [];
        await runWithTransactionSynchronization(async () => {
            registerSynchronization({ afterCommit: async () => { outer.push("outer"); } });
            await runWithTransactionSynchronization(async () => {
                registerSynchronization({ afterCommit: async () => { inner.push("inner"); } });
                await runAfterCommitHooks();
                expect(inner).toEqual(["inner"]);
                expect(outer).toEqual([]);
            });
            await runAfterCommitHooks();
            expect(outer).toEqual(["outer"]);
        });
    });

    it("returns the function result", async () => {
        const result = await runWithTransactionSynchronization(async () => {
            return 42;
        });
        expect(result).toBe(42);
    });
});
