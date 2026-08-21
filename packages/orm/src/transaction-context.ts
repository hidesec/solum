import { AsyncLocalStorage } from "async_hooks";
import { container } from "@solumjs/core";
import { DatabaseDriver, DbExecutor } from "./types";

const DRIVER_TOKEN = "DatabaseDriver";

const transactionStorage = new AsyncLocalStorage<DbExecutor>();

export function registerDatabaseDriver(driver: DatabaseDriver): void {
    container.register(DRIVER_TOKEN, { useValue: driver });
}

export function getDatabaseDriver(): DatabaseDriver {
    return container.resolve<DatabaseDriver>(DRIVER_TOKEN);
}

export function getQueryRunner(): DbExecutor {
    const activeTransaction = transactionStorage.getStore();
    if (activeTransaction) {
        return activeTransaction;
    }
    return getDatabaseDriver();
}

export function getActiveTransactionClient(): DbExecutor | undefined {
    return transactionStorage.getStore();
}

export function runInTransactionContext<T>(client: DbExecutor, fn: () => Promise<T>): Promise<T> {
    return transactionStorage.run(client, fn);
}
