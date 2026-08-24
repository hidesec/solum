import { AutoWired, inject } from "@solumjs/core";
import { ServiceUnavailableException } from "@solumjs/core";
import { Get, RestController } from "@solumjs/http";
import { DatabaseDriver } from "@solumjs/orm";
import { Value } from "@solumjs/config";
import { logger } from "@config/logger";

@RestController()
export class HealthController {
    @AutoWired("DatabaseDriver")
    declare private driver: DatabaseDriver;

    @Value("MONGO_URL")
    mongoUrl?: string;

    @Value("REDIS_URL")
    redisUrl?: string;

    @Get("/health")
    check = async () => {
        const checks: Record<string, string> = {};

        // Database check
        try {
            await this.driver.query("SELECT 1");
            checks.database = "ok";
        } catch (err) {
            checks.database = "error";
            logger.error({ err }, "[HealthCheck] Database check failed");
        }

        // MongoDB check (optional)
        if (this.mongoUrl) {
            checks.mongodb = "configured";
        } else {
            checks.mongodb = "not_configured";
        }

        // Redis check (optional)
        if (this.redisUrl) {
            checks.redis = "configured";
        } else {
            checks.redis = "not_configured";
        }

        const allOk = Object.values(checks).every((v) => v === "ok" || v === "configured" || v === "not_configured");

        if (!allOk) {
            throw new ServiceUnavailableException("Health check failed");
        }

        return {
            status: "ok",
            ...checks,
            client: this.driver.clientName,
            timestamp: new Date().toISOString(),
        };
    };
}
