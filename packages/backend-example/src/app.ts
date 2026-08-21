import "@solumjs/core";
import { createApplication, createEnvConfig, loadEnv } from "@solumjs/config";
import { env } from "@config/env";
import { logger } from "@config/logger";
import { printStartupBanner } from "@config/startup-banner";

loadEnv();

createApplication({
    logger,
    config: createEnvConfig(env),
    scanBaseDir: __dirname,
    scanDirs: ["repositories", "services", "config/beans", "controllers", "advice", "auth", "tasks"],
    bodyLimitBytes: 10 * 1024,
    onListen: printStartupBanner,
});
