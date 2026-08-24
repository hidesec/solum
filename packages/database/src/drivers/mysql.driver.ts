import { getDialect } from "@solumjs/orm";
import { DatabaseDriver, DbExecutor, QueryResult } from "@solumjs/orm";

export interface MysqlConnectionOptions {
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

type MysqlPool = {
    query(sql: string, params?: unknown[]): Promise<[unknown, unknown]>;
    getConnection(): Promise<MysqlConnection>;
};

type MysqlConnection = {
    query(sql: string, params?: unknown[]): Promise<[unknown, unknown]>;
    beginTransaction(): Promise<void>;
    commit(): Promise<void>;
    rollback(): Promise<void>;
    release(): void;
};

function toQueryResult(result: unknown): QueryResult {
    if (Array.isArray(result)) {
        const isRows = result.length === 0 || typeof result[0] === "object";
        if (isRows) return { rows: result as any[], rowCount: result.length };
        const header = result[0] as { affectedRows?: number };
        return { rows: [], rowCount: header?.affectedRows ?? 0 };
    }
    const header = result as { affectedRows?: number };
    return { rows: [], rowCount: header?.affectedRows ?? 0 };
}

export class MysqlDriver implements DatabaseDriver {
    readonly clientName = "mysql" as const;
    readonly dialect = getDialect("mysql");
    private pool?: MysqlPool;

    constructor(private readonly options: MysqlConnectionOptions) {}

    static async create(options: MysqlConnectionOptions): Promise<MysqlDriver> {
        let mysql2: { createPool: (cfg: object) => MysqlPool };
        try {
            mysql2 = (await import("mysql2/promise")) as unknown as { createPool: (cfg: object) => MysqlPool };
        } catch {
            throw new Error('DB_CLIENT=mysql requires the "mysql2" package. Install it with: npm install mysql2');
        }

        const driver = new MysqlDriver(options);
        driver.pool = mysql2.createPool({
            host: options.host,
            port: options.port,
            database: options.database,
            user: options.user,
            password: options.password,
            connectionLimit: options.pool?.max ?? 10,
            dateStrings: false,
        });
        return driver;
    }

    async connect(): Promise<void> {
        await this.pool!.query("SELECT 1");
    }

    async query(sql: string, params: unknown[] = []): Promise<QueryResult> {
        const [result] = await this.pool!.query(this.dialect.translateSql(sql), params);
        return toQueryResult(result);
    }

    async transaction<T>(fn: (tx: DbExecutor) => Promise<T>): Promise<T> {
        const connection = await this.pool!.getConnection();
        try {
            await connection.beginTransaction();
            const executor: DbExecutor = {
                query: async (sql, params = []) => {
                    const [result] = await connection.query(this.dialect.translateSql(sql), params);
                    return toQueryResult(result);
                },
            };
            const result = await fn(executor);
            await connection.commit();
            return result;
        } catch (err) {
            await connection.rollback();
            throw err;
        } finally {
            connection.release();
        }
    }

    async close(): Promise<void> {
        await (this.pool as { end?: () => Promise<void> })?.end?.();
    }
}
