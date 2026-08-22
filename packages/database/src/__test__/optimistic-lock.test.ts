import {
    Column,
    ColumnType,
    Entity,
    getDialect,
    PrimaryGeneratedColumn,
    QueryResult,
    registerDatabaseDriver,
    VersionColumn,
} from "@solumjs/orm";
import { BaseRepository } from "../base.repository";
import { IBaseRepository } from "../base-repository.interface";
import { OptimisticLockException } from "../optimistic-lock.exception";

@Entity("lock_accounts")
class LockAccount {
    @PrimaryGeneratedColumn(ColumnType.UUID)
    id!: string;

    @Column({ type: ColumnType.INTEGER })
    balance!: number;

    @VersionColumn()
    version!: number;
}

interface ILockRepo extends IBaseRepository<LockAccount, string> {
    findByBalance(balance: number): Promise<LockAccount[]>;
}

class CapturingDriver {
    readonly clientName = "postgres" as const;
    readonly dialect = getDialect("postgres");
    queries: { sql: string; params: unknown[] }[] = [];
    private cannedResults: QueryResult[] = [];

    queue(result: QueryResult): void {
        this.cannedResults.push(result);
    }

    async query(sql: string, params: unknown[] = []): Promise<QueryResult> {
        this.queries.push({ sql, params });
        return this.cannedResults.shift() ?? { rows: [], rowCount: 0 };
    }

    async connect(): Promise<void> {}
    async close(): Promise<void> {}
    async transaction<T>(fn: (tx: unknown) => Promise<T>): Promise<T> {
        return fn({});
    }
}

class LockRepository extends BaseRepository<LockAccount, string> {
    protected readonly entityCtor = LockAccount;
    findById(): Promise<LockAccount | null> {
        throw new Error("not implemented in test");
    }
    findAll(): Promise<LockAccount[]> {
        throw new Error("not implemented in test");
    }
}

describe("optimistic locking via @VersionColumn", () => {
    let driver: CapturingDriver;
    let repo: ILockRepo;

    beforeEach(() => {
        driver = new CapturingDriver();
        registerDatabaseDriver(driver as never);
        repo = new LockRepository() as unknown as ILockRepo;
    });

    it("inserts new entities with version starting at 0", async () => {
        driver.queue({ rows: [{ id: "uuid-1", balance: 100, version: 0 }], rowCount: 1 });

        const account = new LockAccount();
        account.balance = 100;

        const saved = await repo.save(account);

        expect(driver.queries[0].sql).toContain("INSERT INTO public.lock_accounts");
        expect(driver.queries[0].sql).toContain("RETURNING *");
        expect(driver.queries[0].params).toContain(0);
        expect(saved.version).toBe(0);
    });

    it("updates existing entities with version increment and guard", async () => {
        driver.queue({ rows: [{ id: "uuid-1", balance: 150, version: 3 }], rowCount: 1 });

        const account = new LockAccount();
        account.id = "uuid-1";
        account.balance = 150;
        account.version = 2;

        const saved = await repo.save(account);

        const sql = driver.queries[0].sql;
        expect(sql).toContain("UPDATE public.lock_accounts SET");
        expect(sql).toContain("version = version + 1");
        expect(sql).toContain("WHERE id = $3 AND version = $4");
        expect(driver.queries[0].params).toEqual([150, "uuid-1", 2]);
        expect(saved.version).toBe(3);
    });

    it("throws OptimisticLockException when version no longer matches", async () => {
        driver.queue({ rows: [], rowCount: 0 });

        const stale = new LockAccount();
        stale.id = "uuid-1";
        stale.balance = 999;
        stale.version = 7;

        await expect(repo.save(stale)).rejects.toThrow(OptimisticLockException);
        expect(driver.queries).toHaveLength(1);
    });

    it("does not apply version logic when entity has no version column", async () => {
        @Entity("plain_notes")
        class PlainNote {
            @PrimaryGeneratedColumn(ColumnType.UUID)
            id!: string;

            @Column({ type: ColumnType.VARCHAR })
            text!: string;
        }

        class PlainRepository extends BaseRepository<PlainNote, string> {
            protected readonly entityCtor = PlainNote;
            findById(): Promise<PlainNote | null> {
                throw new Error("not implemented in test");
            }
            findAll(): Promise<PlainNote[]> {
                throw new Error("not implemented in test");
            }
        }

        const plainRepo = new PlainRepository();
        driver.queue({ rows: [{ id: "uuid-9", text: "hi" }], rowCount: 1 });

        const note = new PlainNote();
        note.id = "uuid-9";
        note.text = "updated";

        await plainRepo.save(note);

        expect(driver.queries[0].sql).not.toContain("version + 1");
        expect(driver.queries[0].sql).toContain("ON CONFLICT");
    });
});
