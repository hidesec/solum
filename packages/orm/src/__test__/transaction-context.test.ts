import {
    registerDatabaseDriver,
    getDatabaseDriver,
    getQueryRunner,
    getActiveTransactionClient,
    runInTransactionContext,
} from "../transaction-context";

describe("transaction-context", () => {
    const mockDriver = {
        clientName: "sqlite",
        query: jest.fn(),
        connect: jest.fn(),
        close: jest.fn(),
        transaction: jest.fn(),
        dialect: {
            likeOperator: (op: string) => op,
            mapColumn: (c: any) => "TEXT",
            qualifyTable: (s: string, t: string) => t,
            preDDL: () => [],
            createSchemaStmt: () => "",
            fkColumnType: () => "TEXT",
            timestampOnUpdateSuffix: () => "",
        },
    } as any;

    afterEach(() => {
        const { container } = require("@solumjs/core");
        container.clear();
    });

    it("registerDatabaseDriver and getDatabaseDriver", () => {
        registerDatabaseDriver(mockDriver);
        expect(getDatabaseDriver()).toBe(mockDriver);
    });

    it("getQueryRunner returns driver when no transaction active", () => {
        registerDatabaseDriver(mockDriver);
        expect(getQueryRunner()).toBe(mockDriver);
    });

    it("getActiveTransactionClient returns undefined outside transaction", () => {
        expect(getActiveTransactionClient()).toBeUndefined();
    });

    it("runInTransactionContext provides transaction client", async () => {
        const txClient = { query: jest.fn() };
        registerDatabaseDriver(mockDriver);

        await runInTransactionContext(txClient as any, async () => {
            const active = getActiveTransactionClient();
            expect(active).toBe(txClient);
            const runner = getQueryRunner();
            expect(runner).toBe(txClient);
        });

        expect(getActiveTransactionClient()).toBeUndefined();
    });

    it("nested calls see parent transaction", async () => {
        const txClient = { query: jest.fn() };
        registerDatabaseDriver(mockDriver);

        await runInTransactionContext(txClient as any, async () => {
            await runInTransactionContext(txClient as any, async () => {
                expect(getActiveTransactionClient()).toBe(txClient);
            });
            expect(getActiveTransactionClient()).toBe(txClient);
        });
    });
});
