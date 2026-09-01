import fs from "fs";
import path from "path";
import os from "os";
import { createDatabaseDriver } from "../driver.factory";
import { MigrationRunner } from "../migration-runner";
import { setFrameworkConfig } from "@solumjs/core";
import { createEnvConfig } from "@solumjs/config";

describe("createDatabaseDriver", () => {
    const originalEnv = process.env;

    beforeEach(() => {
        process.env = { ...originalEnv };
    });

    afterEach(() => {
        process.env = originalEnv;
    });

    it("creates sqlite driver when DB_CLIENT=sqlite", async () => {
        const tmpFile = path.join(os.tmpdir(), `test-driver-${Date.now()}.db`);
        setFrameworkConfig(createEnvConfig({
            DB_CLIENT: "sqlite",
            DB_FILE: tmpFile,
        }));
        try {
            const driver = await createDatabaseDriver();
            expect(driver).toBeDefined();
            expect(driver.clientName).toBe("sqlite");
            await driver.close();
        } finally {
            if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
        }
    });

    it("throws for unsupported DB_CLIENT", async () => {
        setFrameworkConfig(createEnvConfig({
            DB_CLIENT: "unsupported",
        }));
        await expect(createDatabaseDriver()).rejects.toThrow("Unsupported DB_CLIENT");
    });
});

describe("MigrationRunner", () => {
    let tmpDir: string;

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "migration-test-"));
    });

    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it("run with no migrations does nothing", async () => {
        const mockDriver = {
            clientName: "sqlite",
            query: jest.fn().mockResolvedValue({ rows: [] }),
            transaction: jest.fn(async (fn: Function) => fn({ query: jest.fn() })),
        } as any;

        const runner = new MigrationRunner(mockDriver, tmpDir);
        await expect(runner.run()).resolves.not.toThrow();
    });

    it("rollback with no applied migrations does nothing", async () => {
        const mockDriver = {
            clientName: "sqlite",
            query: jest.fn().mockResolvedValue({ rows: [] }),
            transaction: jest.fn(async (fn: Function) => fn({ query: jest.fn() })),
        } as any;

        const runner = new MigrationRunner(mockDriver, tmpDir);
        await expect(runner.rollback()).resolves.not.toThrow();
    });

    it("applies pending migrations", async () => {
        const sqliteDir = path.join(tmpDir, "sqlite");
        fs.mkdirSync(sqliteDir, { recursive: true });
        fs.writeFileSync(path.join(sqliteDir, "001_create_users.up.sql"), "CREATE TABLE users (id INT);");
        fs.writeFileSync(path.join(sqliteDir, "001_create_users.down.sql"), "DROP TABLE users;");

        const mockDriver = {
            clientName: "sqlite",
            query: jest.fn()
                .mockResolvedValueOnce({ rows: [] })  // ensureMigrationsTable
                .mockResolvedValueOnce({ rows: [] })  // getAppliedMigrations
                .mockResolvedValueOnce({ rows: [{ id: 1 }] })  // insert migration record
                .mockResolvedValueOnce({ rows: [] }),
            transaction: jest.fn(async (fn: Function) => {
                const tx = { query: jest.fn().mockResolvedValue({ rows: [] }) };
                await fn(tx);
                return tx;
            }),
        } as any;

        const runner = new MigrationRunner(mockDriver, tmpDir);
        await expect(runner.run()).resolves.not.toThrow();
    });

    it("rollback applies down migration", async () => {
        const sqliteDir = path.join(tmpDir, "sqlite");
        fs.mkdirSync(sqliteDir, { recursive: true });
        fs.writeFileSync(path.join(sqliteDir, "001_create_users.up.sql"), "CREATE TABLE users (id INT);");
        fs.writeFileSync(path.join(sqliteDir, "001_create_users.down.sql"), "DROP TABLE users;");

        const mockDriver = {
            clientName: "sqlite",
            query: jest.fn()
                .mockResolvedValueOnce({ rows: [] })  // ensureMigrationsTable
                .mockResolvedValueOnce({ rows: [{ name: "001_create_users" }] })  // getAppliedMigrations
                .mockResolvedValueOnce({ rows: [] })  // delete migration record
                .mockResolvedValueOnce({ rows: [] }),
            transaction: jest.fn(async (fn: Function) => {
                const tx = { query: jest.fn().mockResolvedValue({ rows: [] }) };
                await fn(tx);
                return tx;
            }),
        } as any;

        const runner = new MigrationRunner(mockDriver, tmpDir);
        await expect(runner.rollback(1)).resolves.not.toThrow();
    });

    it("rollback skips when no .down.sql file exists", async () => {
        const sqliteDir = path.join(tmpDir, "sqlite");
        fs.mkdirSync(sqliteDir, { recursive: true });
        fs.writeFileSync(path.join(sqliteDir, "001_create.up.sql"), "CREATE TABLE t (id INT);");

        const mockDriver = {
            clientName: "sqlite",
            query: jest.fn()
                .mockResolvedValueOnce({ rows: [] })
                .mockResolvedValueOnce({ rows: [{ name: "001_create" }] }),
            transaction: jest.fn(async (fn: Function) => fn({ query: jest.fn() })),
        } as any;

        const runner = new MigrationRunner(mockDriver, tmpDir);
        await expect(runner.rollback(1)).resolves.not.toThrow();
    });

    it("status prints migration status", async () => {
        const mockDriver = {
            clientName: "sqlite",
            query: jest.fn().mockResolvedValue({ rows: [] }),
        } as any;

        const runner = new MigrationRunner(mockDriver, tmpDir);
        await expect(runner.status()).resolves.not.toThrow();
    });

    it("uses dialect-specific directory", async () => {
        const pgDir = path.join(tmpDir, "postgres");
        fs.mkdirSync(pgDir, { recursive: true });
        fs.writeFileSync(path.join(pgDir, "001_init.up.sql"), "CREATE TABLE t (id INT);");

        const mockDriver = {
            clientName: "postgres",
            query: jest.fn()
                .mockResolvedValueOnce({ rows: [] })
                .mockResolvedValueOnce({ rows: [] })
                .mockResolvedValueOnce({ rows: [] })
                .mockResolvedValueOnce({ rows: [] }),
            transaction: jest.fn(async (fn: Function) => {
                const tx = { query: jest.fn().mockResolvedValue({ rows: [] }) };
                await fn(tx);
                return tx;
            }),
        } as any;

        const runner = new MigrationRunner(mockDriver, tmpDir);
        await expect(runner.run()).resolves.not.toThrow();
    });

    it("generates correct DDL for postgres", async () => {
        const mockDriver = {
            clientName: "postgres",
            query: jest.fn().mockResolvedValue({ rows: [] }),
        } as any;

        const runner = new MigrationRunner(mockDriver, tmpDir);
        await runner.status();

        const createTableCall = mockDriver.query.mock.calls.find(
            (call: any) => typeof call[0] === "string" && call[0].includes("CREATE TABLE")
        );
        expect(createTableCall).toBeDefined();
        expect(createTableCall![0]).toContain("TIMESTAMPTZ");
    });

    it("generates correct DDL for mysql", async () => {
        const mockDriver = {
            clientName: "mysql",
            query: jest.fn().mockResolvedValue({ rows: [] }),
        } as any;

        const runner = new MigrationRunner(mockDriver, tmpDir);
        await runner.status();

        const createTableCall = mockDriver.query.mock.calls.find(
            (call: any) => typeof call[0] === "string" && call[0].includes("CREATE TABLE")
        );
        expect(createTableCall).toBeDefined();
        expect(createTableCall![0]).toContain("DATETIME");
    });
});
