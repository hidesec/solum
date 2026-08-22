import { AsyncLocalStorage } from "async_hooks";

export interface TransactionSynchronization {
    afterCommit?: () => void | Promise<void>;
    afterRollback?: () => void | Promise<void>;
}

interface TransactionContext {
    synchronizations: TransactionSynchronization[];
}

const synchronizationStorage = new AsyncLocalStorage<TransactionContext>();

export function runWithTransactionSynchronization<T>(fn: () => Promise<T>): Promise<T> {
    const ctx: TransactionContext = { synchronizations: [] };
    return synchronizationStorage.run(ctx, fn);
}

export function registerSynchronization(sync: TransactionSynchronization): void {
    const ctx = synchronizationStorage.getStore();
    if (ctx) {
        ctx.synchronizations.push(sync);
    }
}

export async function runAfterCommitHooks(): Promise<void> {
    const ctx = synchronizationStorage.getStore();
    if (!ctx) return;

    for (const sync of ctx.synchronizations) {
        if (sync.afterCommit) {
            await sync.afterCommit();
        }
    }
}

export function runAfterRollbackHooks(): void {
    const ctx = synchronizationStorage.getStore();
    if (!ctx) return;

    for (const sync of ctx.synchronizations) {
        if (sync.afterRollback) {
            try {
                sync.afterRollback();
            } catch (_ignored) {}
        }
    }
}

export function isInTransaction(): boolean {
    return synchronizationStorage.getStore() !== undefined;
}
