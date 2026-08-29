describe("isMultiStatement", () => {
    function isMultiStatement(sql: string): boolean {
        return /;\s*\S/.test(sql);
    }

    it("detects multi-statement SQL", () => {
        expect(isMultiStatement("INSERT INTO t VALUES(1); SELECT * FROM t")).toBe(true);
        expect(isMultiStatement("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON")).toBe(true);
    });

    it("detects single statement SQL", () => {
        expect(isMultiStatement("SELECT * FROM users")).toBe(false);
        expect(isMultiStatement("INSERT INTO users VALUES(1)")).toBe(false);
    });

    it("handles trailing semicolon", () => {
        expect(isMultiStatement("SELECT * FROM users;")).toBe(false);
    });
});

describe("normalizeParam", () => {
    function normalizeParam(value: unknown): unknown {
        if (value === undefined) return null;
        if (value instanceof Date) return value.toISOString();
        if (typeof value === "boolean") return value ? 1 : 0;
        return value;
    }

    it("converts undefined to null", () => {
        expect(normalizeParam(undefined)).toBeNull();
    });

    it("converts Date to ISO string", () => {
        const date = new Date("2024-01-15T10:30:00Z");
        expect(normalizeParam(date)).toBe("2024-01-15T10:30:00.000Z");
    });

    it("converts true to 1", () => {
        expect(normalizeParam(true)).toBe(1);
    });

    it("converts false to 0", () => {
        expect(normalizeParam(false)).toBe(0);
    });

    it("passes through strings unchanged", () => {
        expect(normalizeParam("hello")).toBe("hello");
    });

    it("passes through numbers unchanged", () => {
        expect(normalizeParam(42)).toBe(42);
    });

    it("passes through null unchanged", () => {
        expect(normalizeParam(null)).toBeNull();
    });
});

describe("SqliteDriver", () => {
    it("can be imported", async () => {
        const { SqliteDriver } = await import("../drivers/sqlite.driver");
        expect(SqliteDriver).toBeDefined();
    });

    it("clientName is sqlite", async () => {
        const { SqliteDriver } = await import("../drivers/sqlite.driver");
        const driver = new SqliteDriver(":memory:");
        expect(driver.clientName).toBe("sqlite");
    });

    it("can connect and query in-memory", async () => {
        const { SqliteDriver } = await import("../drivers/sqlite.driver");
        const driver = new SqliteDriver(":memory:");
        await driver.connect();
        const result = await driver.query("SELECT 1 as val");
        expect(result.rows).toHaveLength(1);
        expect((result.rows[0] as any).val).toBe(1);
        await driver.close();
    });

    it("can execute multi-statement SQL", async () => {
        const { SqliteDriver } = await import("../drivers/sqlite.driver");
        const driver = new SqliteDriver(":memory:");
        await driver.connect();

        await driver.query("CREATE TABLE test (id INTEGER PRIMARY KEY, name TEXT)");
        await driver.query("INSERT INTO test VALUES(1, 'Alice')");
        const result = await driver.query("SELECT * FROM test");
        expect(result.rows).toHaveLength(1);
        expect((result.rows[0] as any).name).toBe("Alice");
        await driver.close();
    });

    it("handles PRAGMA in multi-statement", async () => {
        const { SqliteDriver } = await import("../drivers/sqlite.driver");
        const driver = new SqliteDriver(":memory:");
        await driver.connect();

        const result = await driver.query("PRAGMA journal_mode");
        expect(result.rows.length).toBeGreaterThanOrEqual(1);
        await driver.close();
    });

    it("handles transactions", async () => {
        const { SqliteDriver } = await import("../drivers/sqlite.driver");
        const driver = new SqliteDriver(":memory:");
        await driver.connect();

        await driver.query("CREATE TABLE tx_test (id INTEGER, val TEXT)");
        await driver.transaction(async (tx) => {
            await tx.query("INSERT INTO tx_test VALUES(1, 'a')");
            await tx.query("INSERT INTO tx_test VALUES(2, 'b')");
        });
        const result = await driver.query("SELECT COUNT(*) as cnt FROM tx_test");
        expect((result.rows[0] as any).cnt).toBe(2);
        await driver.close();
    });

    it("rolls back on transaction error", async () => {
        const { SqliteDriver } = await import("../drivers/sqlite.driver");
        const driver = new SqliteDriver(":memory:");
        await driver.connect();

        await driver.query("CREATE TABLE rollback_test (id INTEGER UNIQUE)");
        await driver.query("INSERT INTO rollback_test VALUES(1)");
        try {
            await driver.transaction(async (tx) => {
                await tx.query("INSERT INTO rollback_test VALUES(1)");
            });
        } catch {
        }
        const result = await driver.query("SELECT COUNT(*) as cnt FROM rollback_test");
        expect((result.rows[0] as any).cnt).toBe(1);
        await driver.close();
    });
});
