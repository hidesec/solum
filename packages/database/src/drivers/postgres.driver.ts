import { Pool, PoolClient, QueryResult as PgQueryResult } from "pg";
import { getDialect } from "@solumjs/orm";
import { DatabaseDriver, DbExecutor, QueryResult } from "@solumjs/orm";

export interface PostgresConnectionOptions {
    host: string;
    port: number;
    database: string;
    user: string;
    password: string;
    pool?: {
        min?: number;
        max?: number;
        idleTimeoutMillis?: number;
        connectionTimeoutMillis?: number;
    };
}

function toQueryResult(result: PgQueryResult): QueryResult {
    return { rows: result.rows as any[], rowCount: result.rowCount ?? result.rows.length };
}

export class PostgresDriver implements DatabaseDriver {
    readonly clientName = "postgres" as const;
    readonly dialect = getDialect("postgres");
    private readonly pool: Pool;

    constructor(options: PostgresConnectionOptions) {
        this.pool = new Pool({
            host: options.host,
            port: options.port,
            database: options.database,
            user: options.user,
            password: options.password,
            min: options.pool?.min ?? 0,
            max: options.pool?.max ?? 10,
            idleTimeoutMillis: options.pool?.idleTimeoutMillis ?? 30_000,
            connectionTimeoutMillis: options.pool?.connectionTimeoutMillis ?? 5_000,
        });
    }

    async connect(): Promise<void> {
        await this.pool.query("SELECT 1");
    }

    async query(sql: string, params: unknown[] = []): Promise<QueryResult> {
        const result = await this.pool.query(sql, params as any[]);
        return toQueryResult(result);
    }

    async transaction<T>(fn: (tx: DbExecutor) => Promise<T>): Promise<T> {
        const client: PoolClient = await this.pool.connect();
        try {
            await client.query("BEGIN");
            const executor: DbExecutor = {
                query: async (sql, params = []) => toQueryResult(await client.query(sql, params as any[])),
            };
            const result = await fn(executor);
            await client.query("COMMIT");
            return result;
        } catch (err) {
            await client.query("ROLLBACK");
            throw err;
        } finally {
            client.release();
        }
    }

    async close(): Promise<void> {
        await this.pool.end();
    }
}
