import {
    Column,
    ColumnType,
    CreatedAtColumn,
    Entity,
    getDialect,
    PrimaryGeneratedColumn,
    QueryResult,
    registerDatabaseDriver,
} from "@solumjs/orm";
import { BaseRepository } from "../base.repository";
import { IBaseRepository } from "../base-repository.interface";

@Entity("derived_users")
class DerivedUser {
    @PrimaryGeneratedColumn(ColumnType.UUID)
    id!: string;

    @Column({ type: ColumnType.VARCHAR })
    email!: string;

    @Column({ type: ColumnType.VARCHAR })
    status!: string;

    @Column({ type: ColumnType.INTEGER })
    age!: number;

    @CreatedAtColumn()
    createdAt!: Date;
}

interface IDerivedUserRepo extends IBaseRepository<DerivedUser, string> {
    findByEmail(email: string): Promise<DerivedUser[]>;
    findByEmailAndStatus(email: string, status: string): Promise<DerivedUser[]>;
    findByEmailOrAgeGreaterThan(email: string, age: number): Promise<DerivedUser[]>;
    findOneByEmail(email: string): Promise<DerivedUser | null>;
    countByStatus(status: string): Promise<number>;
    existsByEmail(email: string): Promise<boolean>;
    deleteByStatus(status: string): Promise<number>;
    findByEmailContaining(part: string): Promise<DerivedUser[]>;
    findByEmailIgnoreCase(email: string): Promise<DerivedUser[]>;
    findByAgeBetween(min: number, max: number): Promise<DerivedUser[]>;
    findByStatusOrderByAgeDescEmailAsc(status: string): Promise<DerivedUser[]>;
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

class DerivedUserRepository extends BaseRepository<DerivedUser, string> {
    protected readonly entityCtor = DerivedUser;
    findById(id: string): Promise<DerivedUser | null> {
        throw new Error("not implemented in test");
    }
    findAll(): Promise<DerivedUser[]> {
        throw new Error("not implemented in test");
    }
}

describe("derived query methods via repository proxy", () => {
    let driver: CapturingDriver;
    let repo: IDerivedUserRepo;

    beforeEach(() => {
        driver = new CapturingDriver();
        registerDatabaseDriver(driver as never);
        repo = new DerivedUserRepository() as unknown as IDerivedUserRepo;
    });

    it("findByEmail executes SELECT with bound parameter", async () => {
        driver.queue({ rows: [], rowCount: 0 });
        await repo.findByEmail("ada@example.com");

        expect(driver.queries[0].sql).toContain("WHERE email = $1");
        expect(driver.queries[0].params).toEqual(["ada@example.com"]);
    });

    it("findByEmailAndStatus binds parameters in order", async () => {
        await repo.findByEmailAndStatus("ada@example.com", "ACTIVE");

        expect(driver.queries[0].sql).toContain("email = $1 AND status = $2");
        expect(driver.queries[0].params).toEqual(["ada@example.com", "ACTIVE"]);
    });

    it("supports Or connectors and comparison operators", async () => {
        await repo.findByEmailOrAgeGreaterThan("ada@example.com", 21);

        const sql = driver.queries[0].sql;
        expect(sql).toContain("email = $1 OR age > $2");
        expect(driver.queries[0].params).toEqual(["ada@example.com", 21]);
    });

    it("findOneByEmail adds LIMIT 1", async () => {
        await repo.findOneByEmail("ada@example.com");

        expect(driver.queries[0].sql).toContain("LIMIT $2");
        expect(driver.queries[0].params).toEqual(["ada@example.com", 1]);
    });

    it("countByStatus returns count from result", async () => {
        driver.queue({ rows: [{ count: 7 }], rowCount: 1 });
        const count = await repo.countByStatus("ACTIVE");

        expect(count).toBe(7);
        expect(driver.queries[0].sql).toContain("COUNT(*)");
        expect(driver.queries[0].sql).toContain("status = $1");
    });

    it("existsByEmail maps count to boolean", async () => {
        driver.queue({ rows: [{ count: 2 }], rowCount: 1 });
        expect(await repo.existsByEmail("ada@example.com")).toBe(true);

        driver.queue({ rows: [{ count: 0 }], rowCount: 1 });
        expect(await repo.existsByEmail("nobody@example.com")).toBe(false);
    });

    it("deleteByStatus issues DELETE with condition", async () => {
        driver.queue({ rows: [], rowCount: 4 });
        const deleted = await repo.deleteByStatus("ARCHIVED");

        expect(deleted).toBe(4);
        expect(driver.queries[0].sql).toContain("DELETE FROM derived_users WHERE status = $1");
        expect(driver.queries[0].params).toEqual(["ARCHIVED"]);
    });

    it("Containing wraps value with wildcards", async () => {
        await repo.findByEmailContaining("example.com%_");

        const [sql, params] = [driver.queries[0].sql, driver.queries[0].params];
        expect(sql).toContain("email ILIKE $1");
        expect(params[0]).toBe("%example.com\\%\\_%");
    });

    it("IgnoreCase lowers comparison for EQ", async () => {
        await repo.findByEmailIgnoreCase("ADA@EXAMPLE.COM");

        const sql = driver.queries[0].sql;
        expect(sql).toContain("LOWER(email) = LOWER($1)");
    });

    it("Between consumes two parameters", async () => {
        await repo.findByAgeBetween(18, 30);

        expect(driver.queries[0].sql).toContain("age BETWEEN $1 AND $2");
        expect(driver.queries[0].params).toEqual([18, 30]);
    });

    it("OrderBy clause translates to ORDER BY with directions", async () => {
        await repo.findByStatusOrderByAgeDescEmailAsc("ACTIVE");

        expect(driver.queries[0].sql).toContain("ORDER BY age DESC, email ASC");
    });

    it("hydrates results into entity instances with PostLoad support", async () => {
        driver.queue({
            rows: [
                {
                    id: "uuid-1",
                    email: "ada@example.com",
                    status: "ACTIVE",
                    age: 36,
                    createdAt: new Date(),
                },
            ],
            rowCount: 1,
        });

        const users = await repo.findByEmail("ada@example.com");
        expect(users[0]).toBeInstanceOf(DerivedUser);
        expect(users[0].email).toBe("ada@example.com");
    });

    it("rejects derived calls with missing arguments", async () => {
        await expect(
            (repo as unknown as { findByEmailAndStatus(): Promise<unknown> }).findByEmailAndStatus()
        ).rejects.toThrow(/Missing query parameter/);
    });
});
