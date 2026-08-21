import { ColumnMetadata, ColumnType } from "./column.decorator";
import { DbClientName, StatementPlan, UpsertOptions } from "./types";

export interface InsertReturningOptions {
    table: string;
    columnNames: string[];
    values: unknown[];
    pkColumn: string;
}

export interface Dialect {
    readonly name: DbClientName;
    translateSql(sql: string): string;
    qualifyTable(schema: string, table: string): string;
    quote(id: string): string;
    countExpression(): string;
    likeOperator(op: string): string;
    buildUpsert(options: UpsertOptions): StatementPlan;
    buildInsertReturning(options: InsertReturningOptions): StatementPlan;
    preDDL(): string[];
    createSchemaStmt(schema: string): string | null;
    mapColumn(col: ColumnMetadata): string;
    fkColumnType(): string;
    timestampOnUpdateSuffix(): string;
    updatedAtTrigger(schema: string, table: string, column: string): string | null;
    indexStmt(name: string, table: string, columns: string[], unique: boolean): string;
}

type PlaceholderStyle = "$" | "?" | "@p" | ":";

function convertPlaceholders(sql: string, style: PlaceholderStyle): string {
    if (style === "$") return sql;
    if (style === "?") return sql.replace(/\$\d+/g, "?");
    return sql.replace(/\$(\d+)/g, (_m, n) => `${style}${n}`);
}

function stripPgCasts(sql: string): string {
    return sql.replace(/::[a-zA-Z_]+(\[\])?/g, "");
}

function rewriteLimitOffset(sql: string, needsForcedOrderBy: boolean): string {
    const limitOnly = /\bLIMIT\s+\$(\d+)\s*$/i;
    const limitOffset = /\bLIMIT\s+\$(\d+)\s+OFFSET\s+\$(\d+)\s*$/i;

    let result = sql;

    if (limitOffset.test(result)) {
        const fetchClause = "OFFSET $$2 ROWS FETCH NEXT $$1 ROWS ONLY";
        result = needsForcedOrderBy && !/ORDER BY/i.test(result)
            ? result.replace(limitOffset, `ORDER BY (SELECT NULL) ${fetchClause}`)
            : result.replace(limitOffset, fetchClause);
        return result;
    }

    if (limitOnly.test(result)) {
        result = result.replace(limitOnly, "OFFSET 0 ROWS FETCH NEXT $$1 ROWS ONLY");
    }

    return result;
}

function baseTranslate(sql: string, style: PlaceholderStyle, booleanAsNumber: boolean, rewriteFetch: boolean): string {
    let out = stripPgCasts(sql);
    out = out.replace(/\bILIKE\b/gi, "LIKE");

    if (booleanAsNumber) {
        out = out.replace(/\bTRUE\b/g, "1").replace(/\bFALSE\b/g, "0");
    }

    if (rewriteFetch) {
        out = rewriteLimitOffset(out, style === "@p");
    }

    return convertPlaceholders(out, style);
}

function varcharLike(col: ColumnMetadata, fallbackLength: number): string {
    return `${col.type}(${col.length ?? fallbackLength})`;
}

function decimalLike(col: ColumnMetadata): string {
    return `${col.type}(${col.precision ?? 12}, ${col.scale ?? 2})`;
}

function enumCheck(col: ColumnMetadata, columnTypeText: string): string {
    const values = (col.enumValues ?? []).map((v) => `'${v}'`).join(", ");
    return `${columnTypeText} CHECK (${col.columnName} IN (${values}))`;
}

class PostgresDialect implements Dialect {
    readonly name: DbClientName = "postgres";

    translateSql(sql: string): string {
        return sql;
    }

    qualifyTable(schema: string, table: string): string {
        return `${schema}.${table}`;
    }

    quote(id: string): string {
        return `"${id}"`;
    }

    countExpression(): string {
        return "COUNT(*)::int";
    }

    likeOperator(op: string): string {
        return op;
    }

    buildUpsert(o: UpsertOptions): StatementPlan {
        const updateClause = o.updatableColumns.length > 0
            ? `DO UPDATE SET ${o.updatableColumns.map((c) => `${c} = EXCLUDED.${c}`).join(", ")}`
            : "DO NOTHING";
        return {
            statements: [{
                sql: `INSERT INTO ${o.table} (${o.columnNames.join(", ")}) VALUES (${o.columnNames.map((_, i) => `$${i + 1}`).join(", ")}) ON CONFLICT (${o.pkColumn}) ${updateClause} RETURNING *`,
                params: o.values,
            }],
        };
    }

    buildInsertReturning(o: InsertReturningOptions): StatementPlan {
        return {
            statements: [{
                sql: `INSERT INTO ${o.table} (${o.columnNames.join(", ")}) VALUES (${o.columnNames.map((_, i) => `$${i + 1}`).join(", ")}) RETURNING *`,
                params: o.values,
            }],
        };
    }

    preDDL(): string[] {
        return ['CREATE EXTENSION IF NOT EXISTS "pgcrypto";'];
    }

    createSchemaStmt(schema: string): string | null {
        return `CREATE SCHEMA IF NOT EXISTS ${schema};`;
    }

    mapColumn(col: ColumnMetadata): string {
        switch (col.type) {
            case ColumnType.VARCHAR: return varcharLike(col, 255);
            case ColumnType.CHAR: return varcharLike(col, 1);
            case ColumnType.DECIMAL:
            case ColumnType.NUMERIC: return decimalLike(col);
            case ColumnType.ENUM: return enumCheck(col, "VARCHAR(50)");
            default: return col.type;
        }
    }

    fkColumnType(): string {
        return "UUID";
    }

    timestampOnUpdateSuffix(): string {
        return "";
    }

    updatedAtTrigger(schema: string, table: string, column: string): string | null {
        const fnName = `trigger_set_${schema}_${table}_updated_at`;
        return `
CREATE OR REPLACE FUNCTION ${fnName}()
RETURNS TRIGGER AS $$
BEGIN
  NEW.${column} = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_updated_at ON ${schema}.${table};
CREATE TRIGGER set_updated_at
BEFORE UPDATE ON ${schema}.${table}
FOR EACH ROW EXECUTE FUNCTION ${fnName}();
`;
    }

    indexStmt(name: string, table: string, columns: string[], unique: boolean): string {
        return `CREATE ${unique ? "UNIQUE " : ""}INDEX IF NOT EXISTS ${name} ON ${table}(${columns.join(", ")});\n`;
    }
}

class MysqlDialect implements Dialect {
    readonly name: DbClientName = "mysql";

    translateSql(sql: string): string {
        return baseTranslate(sql, "?", false, false);
    }

    qualifyTable(_schema: string, table: string): string {
        return table;
    }

    quote(id: string): string {
        return `\`${id}\``;
    }

    countExpression(): string {
        return "COUNT(*)";
    }

    likeOperator(_op: string): string {
        return "LIKE";
    }

    buildUpsert(o: UpsertOptions): StatementPlan {
        const pkIndex = o.columnNames.indexOf(o.pkColumn);
        const pkValue = o.values[pkIndex];
        const placeholders = o.columnNames.map(() => "?").join(", ");

        const write = o.updatableColumns.length > 0
            ? {
                sql: `INSERT INTO ${o.table} (${o.columnNames.join(", ")}) VALUES (${placeholders}) ON DUPLICATE KEY UPDATE ${o.updatableColumns.map((c) => `${c} = VALUES(${c})`).join(", ")}`,
                params: o.values,
            }
            : {
                sql: `INSERT IGNORE INTO ${o.table} (${o.columnNames.join(", ")}) VALUES (${placeholders})`,
                params: o.values,
            };

        return {
            statements: [
                write,
                { sql: `SELECT * FROM ${o.table} WHERE ${o.pkColumn} = ?`, params: [pkValue] },
            ],
        };
    }

    buildInsertReturning(o: InsertReturningOptions): StatementPlan {
        const pkIndex = o.columnNames.indexOf(o.pkColumn);
        if (pkIndex < 0) {
            throw new Error(`MySQL insert requires the primary key "${o.pkColumn}" to be provided explicitly (no RETURNING support).`);
        }
        const placeholders = o.columnNames.map(() => "?").join(", ");
        return {
            statements: [
                { sql: `INSERT INTO ${o.table} (${o.columnNames.join(", ")}) VALUES (${placeholders})`, params: o.values },
                { sql: `SELECT * FROM ${o.table} WHERE ${o.pkColumn} = ?`, params: [o.values[pkIndex]] },
            ],
        };
    }

    preDDL(): string[] {
        return [];
    }

    createSchemaStmt(_schema: string): string | null {
        return null;
    }

    mapColumn(col: ColumnMetadata): string {
        switch (col.type) {
            case ColumnType.VARCHAR: return varcharLike(col, 255);
            case ColumnType.CHAR: return varcharLike(col, 1);
            case ColumnType.DECIMAL:
            case ColumnType.NUMERIC: return decimalLike(col);
            case ColumnType.UUID: return "CHAR(36)";
            case ColumnType.BOOLEAN: return "TINYINT(1)";
            case ColumnType.TIMESTAMPTZ: return "DATETIME";
            case ColumnType.TIMESTAMP: return "DATETIME";
            case ColumnType.JSONB: return "JSON";
            case ColumnType.TEXT_ARRAY:
            case ColumnType.INTEGER_ARRAY: return "JSON";
            case ColumnType.DOUBLE: return "DOUBLE";
            case ColumnType.SERIAL: return "INT AUTO_INCREMENT";
            case ColumnType.BIGSERIAL: return "BIGINT AUTO_INCREMENT";
            case ColumnType.ENUM: return `ENUM(${(col.enumValues ?? []).map((v) => `'${v}'`).join(", ")})`;
            default: return col.type;
        }
    }

    fkColumnType(): string {
        return "CHAR(36)";
    }

    timestampOnUpdateSuffix(): string {
        return " ON UPDATE CURRENT_TIMESTAMP";
    }

    updatedAtTrigger(_schema: string, _table: string, _column: string): string | null {
        return null;
    }

    indexStmt(name: string, table: string, columns: string[], unique: boolean): string {
        return `CREATE ${unique ? "UNIQUE " : ""}INDEX ${name} ON ${table}(${columns.join(", ")});\n`;
    }
}

class SqliteDialect implements Dialect {
    readonly name: DbClientName = "sqlite";

    translateSql(sql: string): string {
        return baseTranslate(sql, "?", false, false);
    }

    qualifyTable(_schema: string, table: string): string {
        return table;
    }

    quote(id: string): string {
        return `"${id}"`;
    }

    countExpression(): string {
        return "COUNT(*)";
    }

    likeOperator(_op: string): string {
        return "LIKE";
    }

    buildUpsert(o: UpsertOptions): StatementPlan {
        const updateClause = o.updatableColumns.length > 0
            ? `DO UPDATE SET ${o.updatableColumns.map((c) => `${c} = EXCLUDED.${c}`).join(", ")}`
            : "DO NOTHING";
        return {
            statements: [{
                sql: `INSERT INTO ${o.table} (${o.columnNames.join(", ")}) VALUES (${o.columnNames.map((_, i) => `$${i + 1}`).join(", ")}) ON CONFLICT (${o.pkColumn}) ${updateClause} RETURNING *`,
                params: o.values,
            }],
        };
    }

    buildInsertReturning(o: InsertReturningOptions): StatementPlan {
        return {
            statements: [{
                sql: `INSERT INTO ${o.table} (${o.columnNames.join(", ")}) VALUES (${o.columnNames.map((_, i) => `$${i + 1}`).join(", ")}) RETURNING *`,
                params: o.values,
            }],
        };
    }

    preDDL(): string[] {
        return [];
    }

    createSchemaStmt(_schema: string): string | null {
        return null;
    }

    mapColumn(col: ColumnMetadata): string {
        switch (col.type) {
            case ColumnType.VARCHAR: return varcharLike(col, 255);
            case ColumnType.CHAR: return varcharLike(col, 1);
            case ColumnType.DECIMAL:
            case ColumnType.NUMERIC: return decimalLike(col);
            case ColumnType.UUID: return "TEXT";
            case ColumnType.BOOLEAN: return "INTEGER";
            case ColumnType.TIMESTAMPTZ: return "TEXT";
            case ColumnType.TIMESTAMP: return "TEXT";
            case ColumnType.JSONB: return "TEXT";
            case ColumnType.TEXT_ARRAY:
            case ColumnType.INTEGER_ARRAY: return "TEXT";
            case ColumnType.DOUBLE: return "REAL";
            case ColumnType.SERIAL: return "INTEGER PRIMARY KEY AUTOINCREMENT";
            case ColumnType.BIGSERIAL: return "INTEGER PRIMARY KEY AUTOINCREMENT";
            case ColumnType.ENUM: return enumCheck(col, "TEXT");
            default: return col.type;
        }
    }

    fkColumnType(): string {
        return "TEXT";
    }

    timestampOnUpdateSuffix(): string {
        return "";
    }

    updatedAtTrigger(schema: string, table: string, column: string): string | null {
        void schema;
        return `
CREATE TRIGGER IF NOT EXISTS set_updated_at
AFTER UPDATE ON ${table}
FOR EACH ROW
BEGIN
  UPDATE ${table} SET ${column} = CURRENT_TIMESTAMP WHERE rowid = NEW.rowid;
END;
`;
    }

    indexStmt(name: string, table: string, columns: string[], unique: boolean): string {
        return `CREATE ${unique ? "UNIQUE " : ""}INDEX IF NOT EXISTS ${name} ON ${table}(${columns.join(", ")});\n`;
    }
}

class MssqlDialect implements Dialect {
    readonly name: DbClientName = "mssql";

    translateSql(sql: string): string {
        return baseTranslate(sql, "@p", true, true);
    }

    qualifyTable(schema: string, table: string): string {
        return `${schema}.${table}`;
    }

    quote(id: string): string {
        return `[${id}]`;
    }

    countExpression(): string {
        return "COUNT(*)";
    }

    likeOperator(_op: string): string {
        return "LIKE";
    }

    private selectByPk(o: { table: string; pkColumn: string; pkValue: unknown }): { sql: string; params: unknown[] } {
        return { sql: `SELECT * FROM ${o.table} WHERE ${o.pkColumn} = @p1`, params: [o.pkValue] };
    }

    buildUpsert(o: UpsertOptions): StatementPlan {
        const pkIndex = o.columnNames.indexOf(o.pkColumn);
        const pkValue = o.values[pkIndex];

        const updatable = o.updatableColumns;
        const statements: { sql: string; params: unknown[] }[] = [];

        if (updatable.length > 0) {
            const setParams = updatable.map((c) => o.values[o.columnNames.indexOf(c)]);
            statements.push({
                sql: `UPDATE ${o.table} SET ${updatable.map((c, i) => `${c} = @p${i + 1}`).join(", ")} WHERE ${o.pkColumn} = @p${setParams.length + 1}`,
                params: [...setParams, pkValue],
            });
            statements.push({
                sql: `IF @@ROWCOUNT = 0 INSERT INTO ${o.table} (${o.columnNames.join(", ")}) VALUES (${o.columnNames.map((_, i) => `@p${i + 1}`).join(", ")})`,
                params: o.values,
            });
        } else {
            statements.push({
                sql: `IF NOT EXISTS (SELECT 1 FROM ${o.table} WHERE ${o.pkColumn} = @p1) INSERT INTO ${o.table} (${o.columnNames.join(", ")}) VALUES (${o.columnNames.map((_, i) => `@p${i + 1}`).join(", ")})`,
                params: o.values,
            });
        }

        statements.push(this.selectByPk({ table: o.table, pkColumn: o.pkColumn, pkValue }));
        return { statements };
    }

    buildInsertReturning(o: InsertReturningOptions): StatementPlan {
        const pkIndex = o.columnNames.indexOf(o.pkColumn);
        if (pkIndex < 0) {
            throw new Error(`MSSQL insert requires the primary key "${o.pkColumn}" to be provided explicitly (no RETURNING support).`);
        }
        const placeholders = o.columnNames.map((_, i) => `@p${i + 1}`).join(", ");
        return {
            statements: [
                { sql: `INSERT INTO ${o.table} (${o.columnNames.join(", ")}) VALUES (${placeholders})`, params: o.values },
                this.selectByPk({ table: o.table, pkColumn: o.pkColumn, pkValue: o.values[pkIndex] }),
            ],
        };
    }

    preDDL(): string[] {
        return [];
    }

    createSchemaStmt(_schema: string): string | null {
        return null;
    }

    mapColumn(col: ColumnMetadata): string {
        switch (col.type) {
            case ColumnType.VARCHAR: return `NVARCHAR(${col.length ?? 255})`;
            case ColumnType.CHAR: return `NCHAR(${col.length ?? 1})`;
            case ColumnType.TEXT: return "NVARCHAR(MAX)";
            case ColumnType.DECIMAL:
            case ColumnType.NUMERIC: return decimalLike(col);
            case ColumnType.UUID: return "CHAR(36)";
            case ColumnType.BOOLEAN: return "BIT";
            case ColumnType.TIMESTAMPTZ: return "DATETIMEOFFSET";
            case ColumnType.TIMESTAMP: return "DATETIME2";
            case ColumnType.JSONB: return "NVARCHAR(MAX)";
            case ColumnType.JSON: return "NVARCHAR(MAX)";
            case ColumnType.TEXT_ARRAY:
            case ColumnType.INTEGER_ARRAY: return "NVARCHAR(MAX)";
            case ColumnType.DOUBLE: return "FLOAT";
            case ColumnType.SERIAL: return "INT IDENTITY(1,1)";
            case ColumnType.BIGSERIAL: return "BIGINT IDENTITY(1,1)";
            case ColumnType.ENUM: return enumCheck(col, "NVARCHAR(50)");
            default: return col.type;
        }
    }

    fkColumnType(): string {
        return "CHAR(36)";
    }

    timestampOnUpdateSuffix(): string {
        return "";
    }

    updatedAtTrigger(schema: string, table: string, column: string): string | null {
        return `
CREATE TRIGGER set_updated_at
ON ${schema}.${table}
AFTER UPDATE AS
BEGIN
  SET NOCOUNT ON;
  UPDATE t SET ${column} = SYSDATETIME()
  FROM ${schema}.${table} t
  INNER JOIN inserted i ON t.id = i.id;
END;
`;
    }

    indexStmt(name: string, table: string, columns: string[], unique: boolean): string {
        return `CREATE ${unique ? "UNIQUE " : ""}INDEX ${name} ON ${table}(${columns.join(", ")});\n`;
    }
}

class OracleDialect implements Dialect {
    readonly name: DbClientName = "oracle";

    translateSql(sql: string): string {
        return baseTranslate(sql, ":", true, true);
    }

    qualifyTable(_schema: string, table: string): string {
        return table;
    }

    quote(id: string): string {
        return `"${id}"`;
    }

    countExpression(): string {
        return "COUNT(*)";
    }

    likeOperator(_op: string): string {
        return "LIKE";
    }

    buildUpsert(o: UpsertOptions): StatementPlan {
        const pkIndex = o.columnNames.indexOf(o.pkColumn);
        const pkValue = o.values[pkIndex];
        const updatable = o.updatableColumns;

        let bindCounter = 0;
        const nextBind = () => `:${++bindCounter}`;

        const setAssignments = updatable.map((c) => `${c} = ${nextBind()}`).join(", ");
        const setParams = updatable.map((c) => o.values[o.columnNames.indexOf(c)]);

        const updateWhereBind = nextBind();
        const insertBinds = o.columnNames.map(() => nextBind()).join(", ");

        const block = `
BEGIN
  UPDATE ${o.table} SET ${setAssignments} WHERE ${o.pkColumn} = ${updateWhereBind};
  IF SQL%ROWCOUNT = 0 THEN
    INSERT INTO ${o.table} (${o.columnNames.join(", ")}) VALUES (${insertBinds});
  END IF;
END;`;

        const statements: { sql: string; params: unknown[] }[] = [];

        if (updatable.length > 0) {
            statements.push({ sql: block, params: [...setParams, pkValue, ...o.values] });
        } else {
            statements.push({
                sql: `INSERT INTO ${o.table} (${o.columnNames.join(", ")}) VALUES (${o.columnNames.map((_, i) => `:${i + 1}`).join(", ")})`,
                params: o.values,
            });
        }

        statements.push({
            sql: `SELECT * FROM ${o.table} WHERE ${o.pkColumn} = :1`,
            params: [pkValue],
        });

        return { statements };
    }

    buildInsertReturning(o: InsertReturningOptions): StatementPlan {
        const pkIndex = o.columnNames.indexOf(o.pkColumn);
        if (pkIndex < 0) {
            throw new Error(`Oracle insert requires the primary key "${o.pkColumn}" to be provided explicitly (no RETURNING support).`);
        }
        const placeholders = o.columnNames.map((_, i) => `:${i + 1}`).join(", ");
        return {
            statements: [
                { sql: `INSERT INTO ${o.table} (${o.columnNames.join(", ")}) VALUES (${placeholders})`, params: o.values },
                { sql: `SELECT * FROM ${o.table} WHERE ${o.pkColumn} = :1`, params: [o.values[pkIndex]] },
            ],
        };
    }

    preDDL(): string[] {
        return [];
    }

    createSchemaStmt(_schema: string): string | null {
        return null;
    }

    mapColumn(col: ColumnMetadata): string {
        switch (col.type) {
            case ColumnType.VARCHAR: return `VARCHAR2(${col.length ?? 255})`;
            case ColumnType.CHAR: return `CHAR(${col.length ?? 1})`;
            case ColumnType.TEXT: return "CLOB";
            case ColumnType.DECIMAL:
            case ColumnType.NUMERIC: return decimalLike(col);
            case ColumnType.UUID: return "CHAR(36)";
            case ColumnType.BOOLEAN: return "NUMBER(1)";
            case ColumnType.TIMESTAMPTZ: return "TIMESTAMP WITH LOCAL TIME ZONE";
            case ColumnType.TIMESTAMP: return "TIMESTAMP(3)";
            case ColumnType.SMALLINT: return "NUMBER(5)";
            case ColumnType.INTEGER: return "NUMBER(10)";
            case ColumnType.BIGINT: return "NUMBER(19)";
            case ColumnType.JSONB: return "CLOB";
            case ColumnType.JSON: return "CLOB";
            case ColumnType.TEXT_ARRAY:
            case ColumnType.INTEGER_ARRAY: return "CLOB";
            case ColumnType.DOUBLE: return "BINARY_DOUBLE";
            case ColumnType.REAL: return "REAL";
            case ColumnType.SERIAL: return "NUMBER(10) GENERATED ALWAYS AS IDENTITY";
            case ColumnType.BIGSERIAL: return "NUMBER(19) GENERATED ALWAYS AS IDENTITY";
            case ColumnType.ENUM: return enumCheck(col, "VARCHAR2(50)");
            default: return col.type;
        }
    }

    fkColumnType(): string {
        return "CHAR(36)";
    }

    timestampOnUpdateSuffix(): string {
        return "";
    }

    updatedAtTrigger(schema: string, table: string, column: string): string | null {
        return `
CREATE OR REPLACE TRIGGER set_updated_at
BEFORE UPDATE ON ${schema}.${table}
FOR EACH ROW
BEGIN
  :NEW.${column} := SYSTIMESTAMP;
END;
`;
    }

    indexStmt(name: string, table: string, columns: string[], unique: boolean): string {
        return `CREATE ${unique ? "UNIQUE " : ""}INDEX ${name} ON ${table}(${columns.join(", ")});\n`;
    }
}

const REGISTRY: Record<DbClientName, Dialect> = {
    postgres: new PostgresDialect(),
    mysql: new MysqlDialect(),
    sqlite: new SqliteDialect(),
    mssql: new MssqlDialect(),
    oracle: new OracleDialect(),
};

export function getDialect(name: DbClientName): Dialect {
    return REGISTRY[name];
}
