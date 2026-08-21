import {
  ColumnMetadata, EntityMetadata, ForeignKeyMetadata, getAllEntities,
} from "./column.decorator";
import { getFrameworkConfig } from "@solumjs/core";
import { Dialect, getDialect } from "./dialect";
import { DbClientName } from "./types";

function activeDialect(): Dialect {
  return getDialect((getFrameworkConfig().get("DB_CLIENT") ?? "postgres") as DbClientName);
}

function buildColumnLine(dialect: Dialect, col: ColumnMetadata): string {
  let line = `  ${col.columnName} ${dialect.mapColumn(col)}`;
  if (col.isPrimary && !col.type.toString().includes("SERIAL")) line += " PRIMARY KEY";
  if (col.default) line += ` DEFAULT ${col.default}`;
  if (!col.nullable && !col.isPrimary) line += " NOT NULL";
  if (col.unique && !col.isPrimary) line += " UNIQUE";
  if (col.isUpdatedAt) line += dialect.timestampOnUpdateSuffix();
  return line;
}

function resolveForeignKeyTable(fk: ForeignKeyMetadata): string {
  const resolver = (fk as any)._resolveTable as (() => string) | undefined;
  return resolver ? resolver() : fk.referencedTable;
}

export function buildCreateTableSQL(entity: EntityMetadata, dialect: Dialect = activeDialect()): string {
  const qualifiedTable = dialect.qualifyTable(entity.schemaName, entity.tableName);
  const columnLines = entity.columns.map((c) => buildColumnLine(dialect, c));
  const hasUpdatedAt = entity.columns.some((c) => c.isUpdatedAt);

  let sql = "";

  for (const stmt of dialect.preDDL()) {
    sql += `${stmt}\n\n`;
  }

  const createSchema = dialect.createSchemaStmt(entity.schemaName);
  if (createSchema && entity.schemaName !== "public") {
    sql += `${createSchema}\n\n`;
  }

  const fkColumnLines = entity.foreignKeys.map((fk) => {
    let line = `  ${fk.columnName} ${dialect.fkColumnType()}`;
    if (!fk.nullable) line += " NOT NULL";
    if (fk.unique) line += " UNIQUE";
    return line;
  });

  const allColumnLines = [...columnLines, ...fkColumnLines];
  sql += `CREATE TABLE IF NOT EXISTS ${qualifiedTable} (\n${allColumnLines.join(",\n")}`;

  entity.foreignKeys.forEach((fk) => {
    const refTable = resolveForeignKeyTable(fk);
    sql += `,\n  CONSTRAINT fk_${entity.tableName}_${fk.columnName} FOREIGN KEY (${fk.columnName}) REFERENCES ${dialect.qualifyTable(entity.schemaName, refTable)}(${fk.referencedColumn}) ON DELETE ${fk.onDelete}`;
  });

  sql += `\n);\n`;

  entity.columns
    .filter((c) => c.unique && !c.isPrimary)
    .forEach((c) => {
      sql += `\n${dialect.indexStmt(`idx_${entity.tableName}_${c.columnName}`, qualifiedTable, [c.columnName], false)}`;
    });

  entity.foreignKeys.forEach((fk) => {
    sql += `\n${dialect.indexStmt(`idx_${entity.tableName}_${fk.columnName}`, qualifiedTable, [fk.columnName], false)}`;
  });

  entity.indexes.forEach((idx) => {
    const idxName = idx.name ?? `idx_${entity.tableName}_${idx.columns.join("_")}`;
    sql += `\n${dialect.indexStmt(idxName, qualifiedTable, idx.columns, idx.unique ?? false)}`;
  });

  if (hasUpdatedAt) {
    const updatedCol = entity.columns.find((c) => c.isUpdatedAt)!;
    const trigger = dialect.updatedAtTrigger(entity.schemaName, entity.tableName, updatedCol.columnName);
    if (trigger) {
      sql += `\n${trigger}\n`;
    }
  }

  return sql;
}

export function buildManyToManyJoinTableSQL(entity: EntityMetadata, dialect: Dialect = activeDialect()): string[] {
  const statements: string[] = [];

  entity.manyToMany.forEach((rel) => {
    const targetEntityFn = rel.targetEntity();
    const targetMeta = getAllEntities().find((e) => e.target === targetEntityFn);
    if (!targetMeta) {
      console.warn(`Cannot resolve target entity for @ManyToMany "${rel.propertyName}" on ${entity.target.name}`);
      return;
    }

    const joinTable = rel.joinTable ?? `${entity.tableName}_${targetMeta.tableName}`;
    const joinColumn = rel.joinColumn ?? `${entity.tableName.replace(/s$/, "")}_id`;
    const inverseJoinColumn = rel.inverseJoinColumn ?? `${targetMeta.tableName.replace(/s$/, "")}_id`;
    const qualifiedJoinTable = dialect.qualifyTable(entity.schemaName, joinTable);

    let sql = `CREATE TABLE IF NOT EXISTS ${qualifiedJoinTable} (\n`;
    sql += `  ${joinColumn} ${dialect.fkColumnType()} NOT NULL REFERENCES ${dialect.qualifyTable(entity.schemaName, entity.tableName)}(id) ON DELETE CASCADE,\n`;
    sql += `  ${inverseJoinColumn} ${dialect.fkColumnType()} NOT NULL REFERENCES ${dialect.qualifyTable(targetMeta.schemaName, targetMeta.tableName)}(id) ON DELETE CASCADE,\n`;
    sql += `  PRIMARY KEY (${joinColumn}, ${inverseJoinColumn})\n`;
    sql += `);\n`;
    sql += `\n${dialect.indexStmt(`idx_${joinTable}_${inverseJoinColumn}`, qualifiedJoinTable, [inverseJoinColumn], false)}`;

    statements.push(sql);
  });

  return statements;
}

export function buildDropTableSQL(entity: EntityMetadata, dialect: Dialect = activeDialect()): string {
  const qualifiedTable = dialect.qualifyTable(entity.schemaName, entity.tableName);
  let sql = "";

  const hasUpdatedAt = entity.columns.some((c) => c.isUpdatedAt);
  if (hasUpdatedAt && dialect.updatedAtTrigger(entity.schemaName, entity.tableName, "updated_at")) {
    sql += `DROP TRIGGER IF EXISTS set_updated_at ON ${qualifiedTable};\n`;
    if (dialect.name === "postgres") {
      sql += `DROP FUNCTION IF EXISTS trigger_set_${entity.schemaName}_${entity.tableName}_updated_at();\n`;
    }
    sql += `\n`;
  }

  sql += `DROP TABLE IF EXISTS ${qualifiedTable} ${dialect.name === "oracle" ? "" : "CASCADE"};\n`;
  return sql;
}

export function buildDropJoinTableSQL(entity: EntityMetadata, dialect: Dialect = activeDialect()): string[] {
  return entity.manyToMany
    .map((rel) => {
      const targetEntityFn = rel.targetEntity();
      const targetMeta = getAllEntities().find((e) => e.target === targetEntityFn);
      if (!targetMeta) return "";
      const joinTable = rel.joinTable ?? `${entity.tableName}_${targetMeta.tableName}`;
      return `DROP TABLE IF EXISTS ${dialect.qualifyTable(entity.schemaName, joinTable)} ${dialect.name === "oracle" ? "" : "CASCADE"};\n`;
    })
    .filter(Boolean);
}
