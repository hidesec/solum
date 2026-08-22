import path from "path";
import {
    ConfigPort,
    container,
    getFrameworkConfig,
    getFrameworkLogger,
    LoggerPort,
    setFrameworkConfig,
    setFrameworkLogger,
} from "@solumjs/core";
import { NodeHttpAdapter, SolumjsMiddleware } from "@solumjs/http";
import { runPreDestroyHooks } from "@solumjs/core";
import { DatabaseDriver, registerDatabaseDriver } from "@solumjs/orm";
import { connectMongo, createDatabaseDriver } from "@solumjs/database";
import {
    cacheManager,
    connectRedis,
    RedisCacheStore,
} from "@solumjs/cache";
import { startScheduledTasks, stopScheduledTasks } from "@solumjs/schedule";
import {
    createSecurityMiddlewares,
    errorHandler,
    notFoundHandler,
    requestLogger,
} from "@solumjs/middlewares";
import { componentScan } from "./component-scan";
import { listRegisteredRoutes, mountControllers } from "./router-factory";
import { DocsOptions, mountOpenApi } from "./openapi";

export interface CreateApplicationOptions {
    logger?: LoggerPort;
    config?: ConfigPort;
    scanBaseDir?: string;
    scanDirs?: string[];
    port?: number;
    bodyLimitBytes?: number;
    middlewares?: SolumjsMiddleware[];
    autoDatabase?: boolean;
    autoCache?: boolean;
    autoMongo?: boolean;
    docs?: boolean | DocsOptions;
    onListen?: (port: number) => void;
    shutdownTimeoutMs?: number;
}

export interface SolumApplication {
    server: import("http").Server;
    driver?: DatabaseDriver;
    port: number;
    shutdown(): Promise<void>;
}

export async function createApplication(
    options: CreateApplicationOptions = {}
): Promise<SolumApplication> {
    if (options.logger) setFrameworkLogger(options.logger);
    if (options.config) setFrameworkConfig(options.config);

    const logger = options.logger ?? getFrameworkLogger();
    const config = getFrameworkConfig();

    if (options.scanDirs || options.scanBaseDir) {
        componentScan(options.scanBaseDir ?? path.join(process.cwd(), "src"), options.scanDirs);
    }

    const adapter = new NodeHttpAdapter({
        bodyLimitBytes: options.bodyLimitBytes,
        notFoundHandler,
        errorHandler,
    });

    adapter.use(...createSecurityMiddlewares());
    adapter.use(requestLogger());
    if (options.middlewares && options.middlewares.length > 0) {
        adapter.use(...options.middlewares);
    }

    let driver: DatabaseDriver | undefined;
    if (options.autoDatabase !== false) {
        driver = await createDatabaseDriver();
        registerDatabaseDriver(driver);
    }

    if (options.autoCache !== false) {
        const redisUrl = config.get("REDIS_URL");
        if (redisUrl) {
            const redis = await connectRedis(redisUrl);
            cacheManager.useStore(new RedisCacheStore(redis));
            logger.info("Redis cache backend enabled");
        }
    }

    const mongoUrl = config.get("MONGO_URL");
    if (options.autoMongo !== false && mongoUrl) {
        const mongoDb = await connectMongo(mongoUrl);
        container.register("MongoDb", { useValue: mongoDb });
        logger.info(`Connected to MongoDB database "${mongoDb.databaseName}"`);
    }

    mountControllers(adapter);

    const docsOption = options.docs ?? true;
    if (docsOption !== false && process.env.NODE_ENV !== "test") {
        const docsConfig: DocsOptions = docsOption === true ? {} : docsOption;
        if (docsConfig.enabled !== false) {
            mountOpenApi(adapter, docsConfig);
        }
    }

    const port = options.port ?? config.getNumber("PORT") ?? 3000;

    function gracefulShutdown(signal: string): void {
        logger.info(`${signal} received. shutting down gracefully...`);
        application
            .shutdown()
            .then(() => {
                logger.info("Server closed. Exiting process.");
                process.exit(0);
            })
            .catch((err) => {
                logger.error({ err }, "Error during shutdown");
                process.exit(1);
            });

        setTimeout(() => {
            logger.error("Forced shutdown after timeout");
            process.exit(1);
        }, options.shutdownTimeoutMs ?? 10_000).unref();
    }

    process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
    process.on("SIGINT", () => gracefulShutdown("SIGINT"));
    process.on("unhandledRejection", (reason) => {
        logger.error({ reason }, "Unhandled Promise Rejection");
    });
    process.on("uncaughtException", (err) => {
        logger.error({ err }, "Uncaught Exception   Process will exit");
        process.exit(1);
    });

    const server = adapter.listen(port, () => {
        options.onListen?.(port);
        const routes = listRegisteredRoutes();
        logger.info(`Routes registered (${routes.length}):`);
        routes.forEach((r) => {
            logger.info(`  ${r.method.padEnd(6)} ${r.path}`);
        });
        startScheduledTasks();
    }) as import("http").Server;

    const application: SolumApplication = {
        server,
        driver,
        port,
        async shutdown(): Promise<void> {
            stopScheduledTasks();
            await new Promise<void>((resolve) => server.close(() => resolve()));
            if (driver) await driver.close();
            await runPreDestroyHooks();
        },
    };

    return application;
}
