import "@solumjs/core";
import "./container";
import { container } from "@solumjs/core";
import { NodeHttpAdapter } from "@solumjs/http";
import { errorHandler } from "@solumjs/middlewares";
import { createSecurityMiddlewares } from "@solumjs/middlewares";
import { requestLogger } from "@solumjs/middlewares";
import { notFoundHandler } from "@solumjs/middlewares";
import { env } from "@config/env";
import { logger } from "@config/logger";
import { setFrameworkLogger } from "@solumjs/core";
import { ConfigPort, setFrameworkConfig } from "@solumjs/core";
import { printStartupBanner } from "@config/startup-banner";
import { listRegisteredRoutes, mountControllers } from "@solumjs/config";
import { runPreDestroyHooks } from "@solumjs/decorators";
import { startScheduledTasks, stopScheduledTasks } from "@solumjs/schedule";
import { createDatabaseDriver } from "@solumjs/database";
import { registerDatabaseDriver } from "@solumjs/orm";
import { cacheManager, hasRedisConfigured } from "@solumjs/cache";
import { RedisCacheStore, connectRedis, isRedisEnabled } from "@solumjs/cache";
import { connectMongo } from "@solumjs/database";

setFrameworkLogger(logger);

const envConfigAdapter: ConfigPort = {
    get: (key) => {
        const value = (env as Record<string, unknown>)[key];
        return value === undefined || value === null || value === "" ? undefined : String(value);
    },
    getNumber: (key) => {
        const value = (env as Record<string, unknown>)[key];
        if (value === undefined || value === null || value === "") return undefined;
        const parsed = Number(value);
        return Number.isNaN(parsed) ? undefined : parsed;
    },
    getBoolean: (key) => {
        const value = (env as Record<string, unknown>)[key];
        if (value === undefined || value === null || value === "") return undefined;
        return ["1", "true", "yes", "on"].includes(String(value).toLowerCase());
    },
};

setFrameworkConfig(envConfigAdapter);

const httpAdapter = new NodeHttpAdapter({
  bodyLimitBytes: 10 * 1024,
  notFoundHandler,
  errorHandler,
});

httpAdapter.use(...createSecurityMiddlewares());
httpAdapter.use(requestLogger());

async function bootstrap() {
  const driver = await createDatabaseDriver();
  registerDatabaseDriver(driver);

  if (isRedisEnabled()) {
    const redis = await connectRedis(env.REDIS_URL);
    cacheManager.useStore(new RedisCacheStore(redis));
    logger.info("Redis cache backend enabled");
  } else if (hasRedisConfigured()) {
    logger.warn("REDIS_URL configured but empty, using in-memory cache");
  }

  if (env.MONGO_URL) {
    const mongoDb = await connectMongo(env.MONGO_URL);
    container.register("MongoDb", { useValue: mongoDb });
    logger.info(`Connected to MongoDB database "${mongoDb.databaseName}"`);
  }

  mountControllers(httpAdapter);

  const server = httpAdapter.listen(env.PORT, () => {
    printStartupBanner(env.PORT);

    const routes = listRegisteredRoutes();
    logger.info(`Routes registered (${routes.length}):`);
    routes.forEach((r) => {
      logger.info(`  ${r.method.padEnd(6)} ${r.path}`);
    });

    startScheduledTasks();
  }) as import("http").Server;

  return { server, driver };
}

bootstrap()
  .then(({ server, driver }) => {
    function shutdown(signal: string) {
      logger.info(`${signal} received. shutting down gracefully...`);
      stopScheduledTasks();
      server.close(async () => {
        await driver.close();
        await runPreDestroyHooks();
        logger.info("Server closed. Exiting process.");
        process.exit(0);
      });

      setTimeout(() => {
        logger.error("Forced shutdown after timeout");
        process.exit(1);
      }, 10_000);
    }

    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT", () => shutdown("SIGINT"));
  });

process.on("unhandledRejection", (reason) => {
  logger.error({ reason }, "Unhandled Promise Rejection");
});

process.on("uncaughtException", (err) => {
  logger.fatal({ err }, "Uncaught Exception   Process will exit");
  process.exit(1);
});
