import path from "path";
import { loadEnv } from "@solumjs/config";
import { MigrationRunner, createDatabaseDriver } from "@solumjs/database";

loadEnv();

async function main() {
    const command = process.argv[2] ?? "up";

    const driver = await createDatabaseDriver();
    const migrationsDir = path.join(__dirname, "migrations");
    const runner = new MigrationRunner(driver, migrationsDir);

    try {
        switch(command) {
            case "up":
                await runner.run();
                break;
            case "down": {
                const steps = Number(process.argv[3]) || 1;
                await runner.rollback(steps);
                break;
            }
            case "status":
                await runner.status()
                break;
            default:
                console.error(`Unknown command: "${command}". Use "up", "down [steps]", or "status"`);
                process.exit(1);
        }
    } catch(err) {
        console.error("Migration failed:", err);
        process.exit(1);
    } finally {
        await driver.close();
    }
}

main();
