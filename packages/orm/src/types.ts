import { Dialect } from "./dialect";

export interface QueryResult {
    rows: any[];
    rowCount?: number;
}

export interface DbExecutor {
    query(sql: string, params?: unknown[]): Promise<QueryResult>;
}

export type DbClientName = "postgres" | "mysql" | "mssql" | "oracle" | "sqlite";

export interface DatabaseDriver extends DbExecutor {
    readonly clientName: DbClientName;
    readonly dialect: Dialect;
    connect(): Promise<void>;
    transaction<T>(fn: (tx: DbExecutor) => Promise<T>): Promise<T>;
    close(): Promise<void>;
}

export interface UpsertOptions {
    table: string;
    columnNames: string[];
    values: unknown[];
    pkColumn: string;
    updatableColumns: string[];
}

export interface StatementPlan {
    statements: { sql: string; params: unknown[] }[];
}
