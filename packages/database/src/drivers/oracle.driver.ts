import { getDialect } from "@solumjs/orm";
import { DatabaseDriver, DbExecutor, QueryResult } from "@solumjs/orm";

export interface OracleConnectionOptions {
    user: string;
    password: string;
    connectString: string;
    pool?: {
        min?: number;
        max?: number;
        idleTimeoutMillis?: number;
        connectionTimeoutMillis?: number;
    };
}

type OracleConnection = {
    execute(sql: string, params?: unknown[], options?: object): Promise<{ rows?: Record<string, unknown>[]; rowsAffected?: number }>;
    commit(): Promise<void>;
    rollback(): Promise<void>;
    close(): Promise<void>;
};

type OraclePool = {
    getConnection(): Promise<OracleConnection>;
    close(): Promise<void>;
};

type OracleModule = {
    createPool(config: object): Promise<OraclePool>;
    OUT_FORMAT_OBJECT: number;
};

export class OracleDriver implements DatabaseDriver {
    readonly clientName = "oracle" as const;
    readonly dialect = getDialect("oracle");
    private pool?: OraclePool;

    constructor(
        private readonly options: OracleConnectionOptions,
        private readonly moduleRef?: OracleModule
    ) {}

    static async create(options: OracleConnectionOptions): Promise<OracleDriver> {
        let oracledb: OracleModule;
        try {
            const moduleName = "oracledb";
            oracledb = (await import(moduleName)) as unknown as OracleModule;
        } catch {
            throw new Error('DB_CLIENT=oracle requires the "oracledb" package. Install it with: npm install oracledb');
        }

        const driver = new OracleDriver(options, oracledb);
        driver.pool = await oracledb.createPool({
            user: options.user,
            password: options.password,
            connectString: options.connectString,
            poolMin: options.pool?.min ?? 1,
            poolMax: options.pool?.max ?? 10,
            outFormat: oracledb.OUT_FORMAT_OBJECT,
        });
        return driver;
    }

    async connect(): Promise<void> {
        const connection = await this.pool!.getConnection();
        await connection.close();
    }

    async query(sql: string, params: unknown[] = []): Promise<QueryResult> {
        const connection = await this.pool!.getConnection();
        try {
            const result = await connection.execute(this.dialect.translateSql(sql), params, { autoCommit: true });
            return { rows: (result.rows ?? []) as any[], rowCount: result.rowsAffected ?? result.rows?.length ?? 0 };
        } finally {
            await connection.close();
        }
    }

    async transaction<T>(fn: (tx: DbExecutor) => Promise<T>): Promise<T> {
        const connection = await this.pool!.getConnection();
        try {
            const executor: DbExecutor = {
                query: async (sql, params = []) => {
                    const result = await connection.execute(this.dialect.translateSql(sql), params);
                    return { rows: (result.rows ?? []) as any[], rowCount: result.rowsAffected ?? result.rows?.length ?? 0 };
                },
            };

            const result = await fn(executor);
            await connection.commit();
            return result;
        } catch (err) {
            await connection.rollback();
            throw err;
        } finally {
            await connection.close();
        }
    }

    async close(): Promise<void> {
        await this.pool?.close();
    }
}
