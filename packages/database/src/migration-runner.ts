import fs from "fs";
import path from "path";
import crypto from "crypto";
import { DatabaseDriver } from "@solumjs/orm";

interface MigrationPair {
  name: string;
  upPath: string;
  downPath: string;
}

const MIGRATIONS_TABLE = "schema_migrations";

export class MigrationRunner {
  constructor(
    private readonly driver: DatabaseDriver,
    private readonly migrationsDir: string
  ) {}

  async run(): Promise<void> {
    await this.ensureMigrationsTable();
    const all = this.getMigrationPairs();
    const applied = await this.getAppliedMigrations();
    const pending = all.filter((m) => !applied.includes(m.name));

    if (pending.length === 0) {
      console.log("No pending migrations. Database is up to date.");
      return;
    }

    console.log(`Found ${pending.length} pending migration(s):`);
    for (const m of pending) {
      await this.applyUp(m);
    }
    console.log("All migrations applied successfully.");
  }

  async rollback(steps = 1): Promise<void> {
    await this.ensureMigrationsTable();
    const applied = await this.getAppliedMigrations();

    if (applied.length === 0) {
      console.log("Nothing to rollback.");
      return;
    }

    const all = this.getMigrationPairs();
    const toRollback = applied.slice(-steps).reverse();

    for (const name of toRollback) {
      const pair = all.find((m) => m.name === name);
      if (!pair) {
        console.error(`Migration files for "${name}" not found on disk, skipping.`);
        continue;
      }
      await this.applyDown(pair);
    }
    console.log(`Rolled back ${toRollback.length} migration(s).`);
  }

  private async migrationsTableDDL(): Promise<string> {
    switch (this.driver.clientName) {
      case "postgres":
        return `CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        executed_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );`;
      case "mysql":
        return `CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        executed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      );`;
      case "mssql":
        return `IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='${MIGRATIONS_TABLE}' AND xtype='U')
        CREATE TABLE ${MIGRATIONS_TABLE} (
          id INT IDENTITY(1,1) PRIMARY KEY,
          name NVARCHAR(255) NOT NULL UNIQUE,
          executed_at DATETIME2 NOT NULL DEFAULT SYSDATETIME()
        );`;
      case "oracle": {
        const count = await this.countMigrationsTable();
        if (count > 0) return "";
        return `CREATE TABLE ${MIGRATIONS_TABLE} (
        id NUMBER(10) GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        name VARCHAR2(255) NOT NULL UNIQUE,
        executed_at TIMESTAMP DEFAULT SYSTIMESTAMP
      )`;
      }
      case "sqlite":
        return `CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        executed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );`;
    }
  }

  private async countMigrationsTable(): Promise<number> {
    try {
      const result = await this.driver.query(
        `SELECT COUNT(*) AS cnt FROM user_tables WHERE table_name = UPPER('${MIGRATIONS_TABLE}')`
      );
      return Number(result.rows[0]?.cnt ?? 0);
    } catch {
      return 0;
    }
  }

  private async ensureMigrationsTable(): Promise<void> {
    const ddl = await this.migrationsTableDDL();
    if (ddl.trim().length === 0) return;
    await this.driver.query(ddl);
  }

  private getMigrationPairs(): MigrationPair[] {
    const dir = this.dialectSpecificDir();
    if (!fs.existsSync(dir)) return [];

    const upFiles = fs
      .readdirSync(dir)
      .filter((f) => f.endsWith(".up.sql"))
      .sort();

    return upFiles.map((upFile) => {
      const name = upFile.replace(/\.up\.sql$/, "");
      return {
        name,
        upPath: path.join(dir, upFile),
        downPath: path.join(dir, `${name}.down.sql`),
      };
    });
  }

  private dialectSpecificDir(): string {
    const specific = path.join(this.migrationsDir, this.driver.clientName);
    if (fs.existsSync(specific)) return specific;

    const genericExists = fs.existsSync(this.migrationsDir) &&
      fs.readdirSync(this.migrationsDir).some((f) => f.endsWith(".up.sql"));

    return genericExists ? this.migrationsDir : specific;
  }

  private async getAppliedMigrations(): Promise<string[]> {
    const result = await this.driver.query(
      `SELECT name FROM ${MIGRATIONS_TABLE} ORDER BY id ASC`
    );
    return result.rows.map((r) => r.name);
  }

  private async applyUp(migration: MigrationPair): Promise<void> {
    const sql = fs.readFileSync(migration.upPath, "utf-8");
    const checksum = crypto.createHash("sha256").update(sql).digest("hex").slice(0, 16);
    try {
      await this.driver.transaction(async (tx) => {
        await tx.query(sql);
        await tx.query(
          `INSERT INTO ${MIGRATIONS_TABLE} (name, checksum) VALUES ($1, $2)`,
          [migration.name, checksum]
        );
      });
      console.log(`Applied: ${migration.name} [${checksum}]`);
    } catch (err) {
      console.error(`Failed: ${migration.name}`);
      throw err;
    }
  }

  private async applyDown(migration: MigrationPair): Promise<void> {
    if (!fs.existsSync(migration.downPath)) {
      console.error(`No .down.sql file found for: ${migration.name}`);
      return;
    }

    const sql = fs.readFileSync(migration.downPath, "utf-8");
    try {
      await this.driver.transaction(async (tx) => {
        await tx.query(sql);
        await tx.query(`DELETE FROM ${MIGRATIONS_TABLE} WHERE name = $1`, [migration.name]);
      });
      console.log(`Reverted: ${migration.name}`);
    } catch (err) {
      console.error(`Failed to revert: ${migration.name}`);
      throw err;
    }
  }

  async status(): Promise<void> {
    await this.ensureMigrationsTable();
    const all = this.getMigrationPairs();
    const applied = await this.getAppliedMigrations();

    console.log("\nMigration Status:");
    console.log("─".repeat(50));
    all.forEach((m) => {
      console.log(`  ${applied.includes(m.name) ? "V" : "-"} ${m.name}`);
    });
    console.log("─".repeat(50));
  }
}
