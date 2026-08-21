import fs from "fs";
import path from "path";
import { getAllEntities } from "@solumjs/orm";
import { scanEntities } from "./entity-scan";
import { buildCreateTableSQL, buildDropJoinTableSQL, buildDropTableSQL, buildManyToManyJoinTableSQL } from "@solumjs/orm";

function main() {
  const entitiesDir = path.join(__dirname, "..", "entities");
  scanEntities(entitiesDir);

  const migrationsDir = path.join(__dirname, "migrations");
  if (!fs.existsSync(migrationsDir)) fs.mkdirSync(migrationsDir, { recursive: true });

  const targetEntityArg = process.argv[2];
  const allEntities = getAllEntities();

  const entities = targetEntityArg
    ? allEntities.filter((e) => e.target.name.toLowerCase() === targetEntityArg.toLowerCase())
    : allEntities;

  if (entities.length === 0) {
    console.error("No matching @Entity class found.");
    process.exit(1);
  }

  entities.forEach((entity) => {
    const existingUpFiles = fs.readdirSync(migrationsDir).filter((f) => f.endsWith(".up.sql"));
    const identifier = `create_${entity.schemaName}_${entity.tableName}_table`;
    const alreadyExists = existingUpFiles.some((f) => f.includes(identifier));

    if (alreadyExists) {
      console.log(`⏭  Skipped (already exists): ${entity.schemaName}.${entity.tableName}`);
      return;
    }

    let upSql = buildCreateTableSQL(entity);
    const joinTableStatements = buildManyToManyJoinTableSQL(entity);
    if (joinTableStatements.length > 0) {
      upSql += `\n-- Join tables for @ManyToMany relations\n${joinTableStatements.join("\n")}`;
    }

    const dropJoinStatements = buildDropJoinTableSQL(entity);
    let downSql = "";
    if (dropJoinStatements.length > 0) {
      downSql += `-- Drop join tables first (FK dependency)\n${dropJoinStatements.join("\n")}\n`;
    }
    downSql += buildDropTableSQL(entity);

    const nextNumber = String(existingUpFiles.length + 1).padStart(3, "0");
    const baseName = `${nextNumber}_${identifier}`;

    fs.writeFileSync(
      path.join(migrationsDir, `${baseName}.up.sql`),
      `-- Auto-generated from entity: ${entity.target.name}\n-- Schema: ${entity.schemaName}\n-- Created: ${new Date().toISOString()}\n\n${upSql}`
    );

    fs.writeFileSync(
      path.join(migrationsDir, `${baseName}.down.sql`),
      `-- Rollback for: ${entity.target.name}\n-- Created: ${new Date().toISOString()}\n\n${downSql}`
    );

    console.log(`Generated: ${baseName}.up.sql + ${baseName}.down.sql`);
  });
}

main();