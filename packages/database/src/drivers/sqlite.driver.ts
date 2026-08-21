import fs from "fs";
import path from "path";
import { DatabaseSync, StatementSync } from "node:sqlite";
import { getDialect } from "@solumjs/orm";
import { DatabaseDriver, DbExecutor, QueryResult } from "@solumjs/orm";

function isMultiStatement(sql: string): boolean {
    return /;\s*\S/.test(sql);
}

function normalizeParam(value: unknown): unknown {
    if (value === undefined) return null;
    if (value instanceof Date) return value.toISOString();
    if (typeof value === "boolean") return value ? 1 : 0;
    return value;
}

export class SqliteDriver implements DatabaseDriver {
    readonly clientName = "sqlite" as const;
    readonly dialect = getDialect("sqlite");
    private db?: DatabaseSync;

    constructor(private readonly filePath: string) {}

    async connect(): Promise<void> {
        if (this.db) return;

        if (this.filePath !== ":memory:") {
            fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
        }

        this.db = new DatabaseSync(this.filePath);
        this.db.exec("PRAGMA journal_mode = WAL;");
        this.db.exec("PRAGMA foreign_keys = ON;");
    }

    private runOn(db: DatabaseSync, sql: string, params: unknown[]): QueryResult {
        const translated = this.dialect.translateSql(sql);
        const bound = params.map(normalizeParam);

        if (isMultiStatement(translated)) {
            db.exec(translated);
            return { rows: [], rowCount: 0 };
        }

        const stmt: StatementSync = db.prepare(translated);

        if (/^\s*(SELECT|PRAGMA)/i.test(translated)) {
            const rows = stmt.all(...(bound as any[])) as Record<string, unknown>[];
            return { rows: rows as any[], rowCount: rows.length };
        }

        const info = stmt.run(...(bound as any[]));
        return { rows: [], rowCount: Number(info.changes) };
    }

    async query(sql: string, params: unknown[] = []): Promise<QueryResult> {
        await this.connect();
        return this.runOn(this.db!, sql, params);
    }

    async transaction<T>(fn: (tx: DbExecutor) => Promise<T>): Promise<T> {
        await this.connect();

        this.db!.exec("BEGIN");
        try {
            const executor: DbExecutor = {
                query: (sql, params = []) => Promise.resolve(this.runOn(this.db!, sql, params)),
            };

            const result = await fn(executor);
            this.db!.exec("COMMIT");
            return result;
        } catch (err) {
            this.db!.exec("ROLLBACK");
            throw err;
        }
    }

    async close(): Promise<void> {
        this.db?.close();
        this.db = undefined;
    }
}
