import { getFrameworkConfig } from "@solumjs/core";
import { getFrameworkLogger } from "@solumjs/core";
import { DatabaseDriver } from "@solumjs/orm";
import { PostgresDriver } from "./drivers/postgres.driver";
import { SqliteDriver } from "./drivers/sqlite.driver";

const DEFAULT_PORTS: Record<string, number> = {
    postgres: 5432,
    mysql: 3306,
    mssql: 1433,
    oracle: 1521,
};

export async function createDatabaseDriver(): Promise<DatabaseDriver> {
    const config = getFrameworkConfig();
    const client = config.get("DB_CLIENT") ?? "postgres";
    const host = config.get("DB_HOST") ?? "localhost";
    const port = config.getNumber("DB_PORT") ?? DEFAULT_PORTS[client] ?? 5432;
    const database = config.get("DB_NAME") ?? "";
    const user = config.get("DB_USER") ?? "";
    const password = config.get("DB_PASSWORD") ?? "";

    switch (client) {
        case "postgres": {
            const driver = new PostgresDriver({ host, port, database, user, password });
            await driver.connect();
            getFrameworkLogger().info(`Connected to PostgreSQL at ${host}:${port}/${database}`);
            return driver;
        }

        case "sqlite": {
            const file = config.get("DB_FILE") ?? "./data/app.db";
            const driver = new SqliteDriver(file);
            await driver.connect();
            getFrameworkLogger().info(`Connected to SQLite database at ${file}`);
            return driver;
        }

        case "mysql": {
            const { MysqlDriver } = await import("./drivers/mysql.driver");
            const driver = await MysqlDriver.create({ host, port, database, user, password });
            await driver.connect();
            getFrameworkLogger().info(`Connected to MySQL at ${host}:${port}/${database}`);
            return driver;
        }

        case "mssql": {
            const { MssqlDriver } = await import("./drivers/mssql.driver");
            const driver = await MssqlDriver.create({ server: host, port, database, user, password });
            await driver.connect();
            getFrameworkLogger().info(`Connected to MSSQL at ${host}:${port}/${database}`);
            return driver;
        }

        case "oracle": {
            const { OracleDriver } = await import("./drivers/oracle.driver");
            const driver = await OracleDriver.create({
                user,
                password,
                connectString: `${host}:${port}/${database}`,
            });
            await driver.connect();
            getFrameworkLogger().info(`Connected to Oracle at ${host}:${port}/${database}`);
            return driver;
        }

        default:
            throw new Error(
                `Unsupported DB_CLIENT "${client}". Supported clients: postgres, mysql, mssql, oracle, sqlite.`
            );
    }
}
