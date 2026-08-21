import { getDialect } from "@solumjs/orm";
import { DatabaseDriver, DbExecutor, QueryResult } from "@solumjs/orm";

export interface MssqlConnectionOptions {
    server: string;
    port: number;
    database: string;
    user: string;
    password: string;
}

type MssqlRequest = {
    input(name: string, value: unknown): MssqlRequest;
    query(sql: string): Promise<{ recordset?: Record<string, unknown>[]; rowsAffected?: number[] }>;
};

type MssqlPool = {
    request(): MssqlRequest;
    connected: boolean;
    close(): Promise<void>;
};

type MssqlTransaction = {
    begin(): Promise<void>;
    commit(): Promise<void>;
    rollback(): Promise<void>;
    request(): MssqlRequest;
};

type MssqlModule = {
    connect(config: object): Promise<MssqlPool>;
    Transaction: new (pool: MssqlPool) => MssqlTransaction;
    Int: object;
    NVarChar: object;
    Char: object;
    Bit: object;
    DateTime: object;
};

export class MssqlDriver implements DatabaseDriver {
    readonly clientName = "mssql" as const;
    readonly dialect = getDialect("mssql");
    private pool?: MssqlPool;

    constructor(
        private readonly options: MssqlConnectionOptions,
        private readonly moduleRef?: MssqlModule
    ) {}

    static async create(options: MssqlConnectionOptions): Promise<MssqlDriver> {
        let mssql: MssqlModule;
        try {
            const moduleName = "mssql";
            mssql = (await import(moduleName)) as unknown as MssqlModule;
        } catch {
            throw new Error('DB_CLIENT=mssql requires the "mssql" package. Install it with: npm install mssql');
        }

        const driver = new MssqlDriver(options, mssql);
        driver.pool = await mssql.connect({
            server: options.server,
            port: options.port,
            database: options.database,
            user: options.user,
            password: options.password,
            options: { encrypt: false, trustServerCertificate: true },
            requestTimeout: 30_000,
        });
        return driver;
    }

    async connect(): Promise<void> {
        if (!this.pool?.connected) {
            throw new Error("MSSQL pool is not connected");
        }
    }

    private bindParams(request: MssqlRequest, params: unknown[]): MssqlRequest {
        params.forEach((value, i) => {
            request = request.input(`p${i + 1}`, value ?? null);
        });
        return request;
    }

    async query(sql: string, params: unknown[] = []): Promise<QueryResult> {
        const request = this.bindParams(this.pool!.request(), params);
        const result = await request.query(this.dialect.translateSql(sql));
        return {
            rows: (result.recordset ?? []) as any[],
            rowCount: result.rowsAffected?.[0] ?? result.recordset?.length ?? 0,
        };
    }

    async transaction<T>(fn: (tx: DbExecutor) => Promise<T>): Promise<T> {
        const transaction = new (this.moduleRef!.Transaction)(this.pool!);
        try {
            await transaction.begin();

            const executor: DbExecutor = {
                query: async (sql, params = []) => {
                    const request = this.bindParams(transaction.request(), params);
                    const result = await request.query(this.dialect.translateSql(sql));
                    return {
                        rows: (result.recordset ?? []) as any[],
                        rowCount: result.rowsAffected?.[0] ?? result.recordset?.length ?? 0,
                    };
                },
            };

            const result = await fn(executor);
            await transaction.commit();
            return result;
        } catch (err) {
            await transaction.rollback();
            throw err;
        }
    }

    async close(): Promise<void> {
        await this.pool?.close();
    }
}
