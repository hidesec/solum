import { Get, RestController } from "@solumjs/decorators";
import { ServiceUnavailableException } from "@solumjs/core";
import { AutoWired } from "@solumjs/decorators";
import { DatabaseDriver } from "@solumjs/orm";

@RestController()
export class HealthController {
    @AutoWired("DatabaseDriver")
    declare private driver: DatabaseDriver;

    @Get("/health")
    check = async () => {
        try {
            await this.driver.query("SELECT 1");
        } catch {
            throw new ServiceUnavailableException("Database disconnected");
        }

        return { status: "ok", database: "connect", client: this.driver.clientName, timestamp: new Date().toISOString() };
    };
}
