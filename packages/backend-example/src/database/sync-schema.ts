import { loadEnv } from "@solumjs/config";
import { createDatabaseDriver } from "@solumjs/database";
import { getAllEntities, syncSchema, SchemaSyncMode } from "@solumjs/orm";
import path from "path";
import { scanEntities } from "./entity-scan";

loadEnv();

async function main() {
    const mode = (process.argv[2] ?? "validate") as SchemaSyncMode;

    if (mode !== "validate" && mode !== "update") {
        console.error(`Unknown mode: "${mode}". Use "validate" or "update"`);
        process.exit(1);
    }

    scanEntities(path.join(__dirname, "..", "entities"));

    const driver = await createDatabaseDriver();

    try {
        const diff = await syncSchema(driver, mode, getAllEntities());

        if (diff.missingTables.length === 0 && diff.columnChanges.length === 0 &&
            diff.missingForeignKeys.length === 0 && diff.missingIndexes.length === 0) {
            console.log("Schema is in sync.");
            return;
        }

        console.log(`Mode: ${mode}`);
        if (diff.missingTables.length > 0) {
            console.log("Missing tables:", diff.missingTables.map((t) => `${t.schemaName}.${t.tableName}`).join(", "));
        }
        for (const change of diff.columnChanges) {
            console.log(`Column drift: ${change.table}.${change.columnName} (${change.reason}${change.detail ? ` — ${change.detail}` : ""})`);
        }
        if (diff.missingForeignKeys.length > 0) {
            console.log("Missing foreign keys:", diff.missingForeignKeys.map((fk) => fk.constraintName).join(", "));
        }
        if (diff.missingIndexes.length > 0) {
            console.log("Missing indexes:", diff.missingIndexes.map((i) => i.indexName).join(", "));
        }

        if (mode === "update") {
            for (const statement of diff.statements) {
                console.log(`> ${statement.trim()}`);
            }
            console.log(`Applied ${diff.statements.length} statement(s).`);
        } else {
            console.error("Schema drift detected. Run with \"update\" to apply changes.");
            process.exit(1);
        }
    } catch (err) {
        console.error("Schema sync failed:", err);
        process.exit(1);
    } finally {
        await driver.close();
    }
}

main();
