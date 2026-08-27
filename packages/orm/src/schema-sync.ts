import {
    ColumnMetadata,
    ColumnType,
    EntityMetadata,
    ForeignKeyMetadata,
    getAllEntities,
} from "./column.decorator";
import { buildCreateTableSQL } from "./schema-builder";
import { Dialect, getDialect } from "./dialect";
import { DatabaseDriver, DbClientName, QueryResult } from "./types";
import { getFrameworkConfig } from "@solumjs/core";

export type SchemaSyncMode = "validate" | "update";

export interface ActualColumn {
    name: string;
    baseType: string;
    length?: number;
    precision?: number;
    scale?: number;
    nullable: boolean;
}

export interface ActualForeignKey {
    name: string;
    column: string;
    referencedTable: string;
    referencedColumn: string;
}

export interface ActualTable {
    schema: string;
    name: string;
    columns: Map<string, ActualColumn>;
    foreignKeys: Map<string, ActualForeignKey>;
    indexes: Set<string>;
}

export interface IntrospectedSchema {
    clientName: DbClientName;
    tables: Map<string, ActualTable>;
}

export interface ColumnChange {
    table: string;
    columnName: string;
    reason: "missing" | "type-mismatch" | "nullability-mismatch";
    detail?: string;
    column?: ColumnMetadata | ForeignKeyMetadata;
}

export interface SchemaDiff {
    missingTables: EntityMetadata[];
    columnChanges: ColumnChange[];
    missingForeignKeys: { entity: EntityMetadata; foreignKey: ForeignKeyMetadata; constraintName: string }[];
    missingIndexes: { entity: EntityMetadata; indexName: string; columns: string[]; unique: boolean }[];
    statements: string[];
}

export class SchemaValidationError extends Error {
    constructor(public readonly diff: SchemaDiff) {
        super(buildValidationMessage(diff));
        this.name = "SchemaValidationError";
    }
}

function buildValidationMessage(diff: SchemaDiff): string {
    const lines: string[] = ["Schema validation failed. Database is out of sync with entities:"];
    for (const table of diff.missingTables) {
        lines.push(`  - missing table "${table.tableName}"`);
    }
    for (const change of diff.columnChanges) {
        lines.push(`  - column "${change.table}.${change.columnName}": ${change.reason}`);
    }
    for (const fk of diff.missingForeignKeys) {
        lines.push(
            `  - missing foreign key "${fk.constraintName}" on "${fk.entity.tableName}.${fk.foreignKey.columnName}"`
        );
    }
    for (const idx of diff.missingIndexes) {
        lines.push(`  - missing index "${idx.indexName}" on "${idx.entity.tableName}"`);
    }
    return lines.join("\n");
}

function activeDialect(): Dialect {
    return getDialect((getFrameworkConfig().get("DB_CLIENT") ?? "postgres") as DbClientName);
}

function resolveForeignKeyTable(fk: ForeignKeyMetadata): string {
    const resolver = (fk as unknown as { _resolveTable?: () => string })._resolveTable;
    return resolver ? resolver() : fk.referencedTable;
}

function normalizeBaseType(raw: string): string {
    const type = raw.toLowerCase().replace(/\s+/g, " ").trim();
    switch (type) {
        case "character varying":
        case "varchar":
            return "varchar";
        case "char":
        case '"char"':
        case "character":
            return "char";
        case "timestamp with time zone":
        case "timestamptz":
            return "timestamptz";
        case "timestamp without time zone":
        case "timestamp":
        case "datetime2":
        case "datetime":
            return "timestamp";
        case "double precision":
            return "double precision";
        case "int8":
        case "bigserial":
            return type === "bigserial" ? "bigserial" : "bigint";
        case "int4":
            return "integer";
        case "int2":
            return "smallint";
        case "bool":
        case "boolean":
            return "boolean";
        case "_text":
            return "text[]";
        case "_int4":
            return "integer[]";
        default:
            return type;
    }
}

function canonicalColumnType(col: ColumnMetadata | ForeignKeyMetadata, dialect: Dialect): string {
    if ("isPrimary" in col) {
        const mapped = dialect.mapColumn(col as ColumnMetadata).toLowerCase();
        const match = /^([a-z]+(?: [a-z]+)*)(?:\(\d+(?:,\s*\d+)?\))?/.exec(mapped);
        return match ? match[1].trim() : mapped;
    }
    return normalizeBaseType(dialect.fkColumnType());
}

function columnLength(col: ColumnMetadata): number | undefined {
    if (col.type.toString().startsWith("VARCHAR") || col.type.toString().startsWith("CHAR")) {
        return col.length ?? (col.type === ColumnType.CHAR ? 1 : 255);
    }
    return undefined;
}

function typesMatch(desired: ColumnMetadata, actual: ActualColumn, dialect: Dialect): boolean {
    const desiredBase = canonicalColumnType(desired, dialect);
    const actualBase = normalizeBaseType(actual.baseType);

    if (desiredBase !== actualBase) return false;

    const desiredLength = columnLength(desired);
    if (desiredLength !== undefined && actual.length !== undefined && desiredLength !== actual.length) {
        return false;
    }

    return true;
}

export async function introspectSchema(
    driver: DatabaseDriver,
    schemas: string[] = ["public"]
): Promise<IntrospectedSchema> {
    switch (driver.clientName) {
        case "postgres":
            return introspectPostgres(driver, schemas);
        case "mysql":
            return introspectMysql(driver);
        case "sqlite":
            return introspectSqlite(driver);
        default:
            throw new Error(
                `Schema sync does not support dialect "${driver.clientName}". Supported: postgres, mysql, sqlite.`
            );
    }
}

async function introspectPostgres(driver: DatabaseDriver, schemas: string[]): Promise<IntrospectedSchema> {
    const tables = new Map<string, ActualTable>();

    const columnsResult: QueryResult = await driver.query(
        `SELECT table_schema, table_name, column_name, udt_name, data_type,
                character_maximum_length, numeric_precision, numeric_scale, is_nullable
         FROM information_schema.columns
         WHERE table_schema = ANY($1)
         ORDER BY table_name, ordinal_position`,
        [schemas]
    );

    for (const row of columnsResult.rows) {
        const key = `${row.table_schema}.${row.table_name}`;
        let table = tables.get(key);
        if (!table) {
            table = { schema: row.table_schema, name: row.table_name, columns: new Map(), foreignKeys: new Map(), indexes: new Set() };
            tables.set(key, table);
        }
        table.columns.set(row.column_name, {
            name: row.column_name,
            baseType: row.data_type === "ARRAY" ? `_${row.udt_name.replace(/^_/, "")}` : row.data_type,
            length: row.character_maximum_length ?? undefined,
            precision: row.numeric_precision ?? undefined,
            scale: row.numeric_scale ?? undefined,
            nullable: row.is_nullable === "YES",
        });
    }

    const fkResult = await driver.query(
        `SELECT tc.table_schema, tc.table_name, tc.constraint_name, kcu.column_name,
                ccu.table_name AS ref_table, ccu.column_name AS ref_column
         FROM information_schema.table_constraints tc
         JOIN information_schema.key_column_usage kcu
           ON tc.constraint_name = kcu.constraint_name AND tc.constraint_schema = kcu.constraint_schema
         JOIN information_schema.constraint_column_usage ccu
           ON tc.constraint_name = ccu.constraint_name AND tc.constraint_schema = ccu.constraint_schema
         WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = ANY($1)`,
        [schemas]
    );

    for (const row of fkResult.rows) {
        const table = tables.get(`${row.table_schema}.${row.table_name}`);
        if (!table) continue;
        table.foreignKeys.set(row.constraint_name, {
            name: row.constraint_name,
            column: row.column_name,
            referencedTable: row.ref_table,
            referencedColumn: row.ref_column,
        });
    }

    const indexResult = await driver.query(
        `SELECT schemaname, tablename, indexname FROM pg_indexes WHERE schemaname = ANY($1)`,
        [schemas]
    );

    for (const row of indexResult.rows) {
        const table = tables.get(`${row.schemaname}.${row.tablename}`);
        if (!table) continue;
        table.indexes.add(row.indexname);
    }

    return { clientName: driver.clientName, tables };
}

async function introspectMysql(driver: DatabaseDriver): Promise<IntrospectedSchema> {
    const tables = new Map<string, ActualTable>();

    const columnsResult = await driver.query(
        `SELECT TABLE_SCHEMA, TABLE_NAME, COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH,
                NUMERIC_PRECISION, NUMERIC_SCALE, IS_NULLABLE
         FROM information_schema.columns
         WHERE TABLE_SCHEMA = DATABASE()
         ORDER BY TABLE_NAME, ORDINAL_POSITION`
    );

    for (const row of columnsResult.rows) {
        const key = `${row.TABLE_SCHEMA}.${row.TABLE_NAME}`;
        let table = tables.get(key);
        if (!table) {
            table = { schema: row.TABLE_SCHEMA, name: row.TABLE_NAME, columns: new Map(), foreignKeys: new Map(), indexes: new Set() };
            tables.set(key, table);
        }
        table.columns.set(row.COLUMN_NAME, {
            name: row.COLUMN_NAME,
            baseType: normalizeBaseType(row.DATA_TYPE),
            length: row.CHARACTER_MAXIMUM_LENGTH ?? undefined,
            precision: row.NUMERIC_PRECISION ?? undefined,
            scale: row.NUMERIC_SCALE ?? undefined,
            nullable: row.IS_NULLABLE === "YES",
        });
    }

    const fkResult = await driver.query(
        `SELECT TABLE_NAME, CONSTRAINT_NAME, COLUMN_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME
         FROM information_schema.KEY_COLUMN_USAGE
         WHERE TABLE_SCHEMA = DATABASE() AND REFERENCED_TABLE_NAME IS NOT NULL`
    );

    for (const row of fkResult.rows) {
        const table = tables.get(Array.from(tables.keys()).find((k) => tables.get(k)!.name === row.TABLE_NAME) ?? "");
        if (!table) continue;
        table.foreignKeys.set(row.CONSTRAINT_NAME, {
            name: row.CONSTRAINT_NAME,
            column: row.COLUMN_NAME,
            referencedTable: row.REFERENCED_TABLE_NAME,
            referencedColumn: row.REFERENCED_COLUMN_NAME,
        });
    }

    const indexResult = await driver.query(
        `SELECT DISTINCT TABLE_NAME, INDEX_NAME FROM information_schema.STATISTICS
         WHERE TABLE_SCHEMA = DATABASE() AND INDEX_NAME != 'PRIMARY'`
    );

    for (const row of indexResult.rows) {
        const entry = Array.from(tables.values()).find((t) => t.name === row.TABLE_NAME);
        if (!entry) continue;
        entry.indexes.add(row.INDEX_NAME);
    }

    return { clientName: driver.clientName, tables };
}

async function introspectSqlite(driver: DatabaseDriver): Promise<IntrospectedSchema> {
    const tables = new Map<string, ActualTable>();
    const SAFE_TABLE = /^[a-zA-Z0-9_]+$/;
    const masterResult = await driver.query(
        `SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'`
    );

    for (const row of masterResult.rows) {
        const tableName = row.name;
        if (!SAFE_TABLE.test(tableName)) continue;
        const table: ActualTable = { schema: "main", name: tableName, columns: new Map(), foreignKeys: new Map(), indexes: new Set() };

        const infoResult = await driver.query(`PRAGMA table_info("${tableName}")`);
        for (const col of infoResult.rows) {
            table.columns.set(col.name, {
                name: col.name,
                baseType: normalizeBaseType(String(col.type ?? "")),
                nullable: col.notnull === 0,
            });
        }

        const fkListResult = await driver.query(`PRAGMA foreign_key_list("${tableName}")`);
        fkListResult.rows.forEach((fk, i) => {
            table.foreignKeys.set(`fk_${tableName}_${i}`, {
                name: `fk_${tableName}_${i}`,
                column: fk.from,
                referencedTable: fk.table,
                referencedColumn: fk.to,
            });
        });

        tables.set(`main.${tableName}`, table);
    }

    return { clientName: driver.clientName, tables };
}

export function diffSchema(
    entities: EntityMetadata[],
    actual: IntrospectedSchema,
    dialect: Dialect = activeDialect()
): SchemaDiff {
    const diff: SchemaDiff = {
        missingTables: [],
        columnChanges: [],
        missingForeignKeys: [],
        missingIndexes: [],
        statements: [],
    };

    for (const entity of entities) {
        const tableKey = `${entity.schemaName}.${entity.tableName}`;
        const actualTable = actual.tables.get(tableKey);

        if (!actualTable) {
            diff.missingTables.push(entity);
            continue;
        }

        for (const col of entity.columns) {
            const actualCol = actualTable.columns.get(col.columnName);
            if (!actualCol) {
                diff.columnChanges.push({ table: entity.tableName, columnName: col.columnName, reason: "missing", column: col });
                continue;
            }
            if (!typesMatch(col, actualCol, dialect)) {
                diff.columnChanges.push({
                    table: entity.tableName,
                    columnName: col.columnName,
                    reason: "type-mismatch",
                    detail: `expected ${canonicalColumnType(col, dialect)}, found ${normalizeBaseType(actualCol.baseType)}`,
                    column: col,
                });
                continue;
            }
            if (col.nullable === false && !col.isPrimary && actualCol.nullable) {
                diff.columnChanges.push({
                    table: entity.tableName,
                    columnName: col.columnName,
                    reason: "nullability-mismatch",
                    detail: "expected NOT NULL but column is nullable",
                    column: col,
                });
            }
        }

        for (const fk of entity.foreignKeys) {
            const actualCol = actualTable.columns.get(fk.columnName);
            if (!actualCol) {
                diff.columnChanges.push({ table: entity.tableName, columnName: fk.columnName, reason: "missing", column: fk });
                continue;
            }
            const constraintName = `fk_${entity.tableName}_${fk.columnName}`;
            const existingFk = Array.from(actualTable.foreignKeys.values()).find((candidate) => candidate.column === fk.columnName);
            if (!existingFk) {
                diff.missingForeignKeys.push({ entity, foreignKey: fk, constraintName });
            }
        }

        for (const col of entity.columns.filter((c) => c.unique && !c.isPrimary)) {
            const indexName = `idx_${entity.tableName}_${col.columnName}`;
            if (!actualTable.indexes.has(indexName)) {
                diff.missingIndexes.push({ entity, indexName, columns: [col.columnName], unique: false });
            }
        }

        for (const idx of entity.indexes) {
            const indexName = idx.name ?? `idx_${entity.tableName}_${idx.columns.join("_")}`;
            if (!actualTable.indexes.has(indexName)) {
                diff.missingIndexes.push({ entity, indexName, columns: idx.columns, unique: idx.unique ?? false });
            }
        }
    }

    return diff;
}

export async function validateSchema(
    driver: DatabaseDriver,
    entities: EntityMetadata[] = getAllEntities(),
    schemas?: string[]
): Promise<SchemaDiff> {
    const allSchemas = schemas ?? Array.from(new Set(entities.map((e) => e.schemaName)));
    const actual = await introspectSchema(driver, allSchemas);
    const diff = diffSchema(entities, actual);

    if (
        diff.missingTables.length > 0 ||
        diff.columnChanges.length > 0 ||
        diff.missingForeignKeys.length > 0 ||
        diff.missingIndexes.length > 0
    ) {
        throw new SchemaValidationError(diff);
    }

    return diff;
}

export async function syncSchema(
    driver: DatabaseDriver,
    mode: SchemaSyncMode,
    entities: EntityMetadata[] = getAllEntities(),
    schemas?: string[],
    dialect: Dialect = activeDialect()
): Promise<SchemaDiff> {
    const allSchemas = schemas ?? Array.from(new Set(entities.map((e) => e.schemaName)));
    const actual = await introspectSchema(driver, allSchemas);
    const diff = diffSchema(entities, actual, dialect);

    if (mode === "validate") {
        if (
            diff.missingTables.length > 0 ||
            diff.columnChanges.length > 0 ||
            diff.missingForeignKeys.length > 0 ||
            diff.missingIndexes.length > 0
        ) {
            throw new SchemaValidationError(diff);
        }
        return diff;
    }

    const statements: string[] = [];

    for (const entity of diff.missingTables) {
        statements.push(buildCreateTableSQL(entity, dialect));
    }

    for (const change of diff.columnChanges) {
        if (change.reason === "missing" && change.column) {
            statements.push(buildAddColumnSQL(change.table, change.column, dialect));
        } else if (change.reason === "type-mismatch" && change.column) {
            statements.push(buildAlterColumnTypeSQL(change.table, change.column, dialect));
        } else if (change.reason === "nullability-mismatch" && change.column) {
            statements.push(
                dialect.translateSql(
                    `ALTER TABLE ${dialect.qualifyTable("public", change.table)} ALTER COLUMN ${change.columnName} SET NOT NULL;`
                )
            );
        }
    }

    for (const fk of diff.missingForeignKeys) {
        const refTable = resolveForeignKeyTable(fk.foreignKey);
        statements.push(
            dialect.translateSql(
                `ALTER TABLE ${dialect.qualifyTable(fk.entity.schemaName, fk.entity.tableName)} ` +
                `ADD CONSTRAINT ${fk.constraintName} FOREIGN KEY (${fk.foreignKey.columnName}) ` +
                `REFERENCES ${dialect.qualifyTable(fk.entity.schemaName, refTable)}(${fk.foreignKey.referencedColumn}) ` +
                `ON DELETE ${fk.foreignKey.onDelete};`
            )
        );
    }

    for (const index of diff.missingIndexes) {
        statements.push(
            dialect.indexStmt(
                index.indexName,
                dialect.qualifyTable(index.entity.schemaName, index.entity.tableName),
                index.columns,
                index.unique
            )
        );
    }

    diff.statements = statements;

    for (const statement of statements) {
        await driver.query(statement);
    }

    return diff;
}

function buildAddColumnSQL(tableName: string, col: ColumnMetadata | ForeignKeyMetadata, dialect: Dialect): string {
    const qualified = dialect.qualifyTable("public", tableName);
    let typePart: string;
    let notNull = false;
    let defaultExpr: string | undefined;

    if ("isPrimary" in col) {
        const meta = col as ColumnMetadata;
        typePart = dialect.mapColumn(meta);
        notNull = !meta.nullable && !meta.isPrimary;
        defaultExpr = meta.default;
        if (meta.isVersion) defaultExpr = defaultExpr ?? "0";
    } else {
        const fk = col as ForeignKeyMetadata;
        typePart = dialect.fkColumnType();
        notNull = !fk.nullable;
    }

    let sql = `ALTER TABLE ${qualified} ADD COLUMN ${col.columnName} ${typePart}`;
    if (defaultExpr) sql += ` DEFAULT ${defaultExpr}`;
    if (notNull) sql += ` NOT NULL`;
    return dialect.translateSql(`${sql};`);
}

function buildAlterColumnTypeSQL(tableName: string, col: ColumnMetadata | ForeignKeyMetadata, dialect: Dialect): string {
    const qualified = dialect.qualifyTable("public", tableName);
    const typePart = "isPrimary" in col
        ? dialect.mapColumn(col as ColumnMetadata)
        : dialect.fkColumnType();
    const usingClause = dialect.name === "postgres" ? ` USING ${col.columnName}::${typePart}` : "";
    return dialect.translateSql(
        `ALTER TABLE ${qualified} ALTER COLUMN ${col.columnName} TYPE ${typePart}${usingClause};`
    );
}
