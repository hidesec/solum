import { DatabaseDriver, DbClientName, DbExecutor, QueryResult, registerDatabaseDriver, getQueryRunner } from "@solumjs/orm";
import { Transactional } from "../transactional.decorator";

class FakeDriver implements DatabaseDriver {
    readonly clientName: DbClientName = "sqlite";
    readonly dialect = {} as DatabaseDriver["dialect"];
    log: string[] = [];
    private txExecutor: DbExecutor | undefined;

    executorFor(): DbExecutor {
        return {
            query: async () => {
                this.log.push(this.txExecutor ? "tx-stmt" : "base-stmt");
                return { rows: [], rowCount: 0 } as QueryResult;
            },
        };
    }

    async query(): Promise<QueryResult> {
        this.log.push("base-stmt");
        return { rows: [], rowCount: 0 };
    }

    async connect(): Promise<void> {}

    async close(): Promise<void> {}

    async transaction<T>(fn: (tx: DbExecutor) => Promise<T>): Promise<T> {
        this.log.push("begin");
        this.txExecutor = {
            query: async () => {
                this.log.push("tx-stmt");
                return { rows: [], rowCount: 0 } as QueryResult;
            },
        };
        try {
            const result = await fn(this.txExecutor);
            this.log.push("commit");
            return result;
        } catch (err) {
            this.log.push("rollback");
            throw err;
        } finally {
            this.txExecutor = undefined;
        }
    }
}

class TxService {
    @Transactional()
    async succeed(value: string): Promise<string> {
        await getQueryRunner().query("INSERT 1");
        return value.toUpperCase();
    }

    @Transactional()
    async fail(): Promise<string> {
        await getQueryRunner().query("DELETE 1");
        throw new Error("boom-inside-tx");
    }

    @Transactional()
    async outer(): Promise<string> {
        return this.inner();
    }

    @Transactional()
    async inner(): Promise<string> {
        await getQueryRunner().query("INNER 1");
        return "inner-done";
    }
}

describe("@Transactional", () => {
    let driver: FakeDriver;
    let service: TxService;

    beforeEach(() => {
        driver = new FakeDriver();
        registerDatabaseDriver(driver);
        service = new TxService();
    });

    it("commit saat sukses dan query diarahkan ke executor transaksi", async () => {
        await expect(service.succeed("ok")).resolves.toBe("OK");
        expect(driver.log).toEqual(["begin", "tx-stmt", "commit"]);
    });

    it("rollback DAN error asli tetap dilempar saat method gagal", async () => {
        await expect(service.fail()).rejects.toThrow("boom-inside-tx");
        expect(driver.log).toEqual(["begin", "tx-stmt", "rollback"]);
        expect(driver.log).not.toContain("commit");
    });

    it("nested @Transactional bergabung ke transaksi berjalan, hanya satu begin/commit", async () => {
        await expect(service.outer()).resolves.toBe("inner-done");
        expect(driver.log).toEqual(["begin", "tx-stmt", "commit"]);
    });
});
