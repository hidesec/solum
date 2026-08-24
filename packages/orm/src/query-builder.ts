import { EntityMetadata, getEntityMetadata, hydrateEntity } from "./column.decorator";
import { getDatabaseDriver, getQueryRunner } from "./transaction-context";
import { QueryResult } from "./types";
import { buildPage, Page, PageRequest } from "@solumjs/http";

export type WhereOperator = "=" | "!=" | "<>" | ">" | ">=" | "<" | "<=" | "LIKE" | "ILIKE";
type JoinType = "INNER" | "LEFT" | "RIGHT" | "FULL";
type Connector = "AND" | "OR";

interface WhereCondition {
    type: "basic" | "in" | "notIn" | "null" | "notNull" | "raw";
    connector: Connector;
    column?: string;
    operator?: WhereOperator;
    value?: any;
    values?: any[];
    sql?: string;
    params?: any[];
}

interface JoinClause {
    type: JoinType;
    table: string;
    leftColumn: string;
    operator: WhereOperator;
    rightColumn: string;
}

interface OrderClause {
    column: string;
    direction: "ASC" | "DESC";
}

const IDENTIFIER_PATTERN = /^[a-zA-Z0-9_."]+$/;

function assertSafeIdentifier(id: string): string {
    if (!IDENTIFIER_PATTERN.test(id)) {
        throw new Error(`Unsafe SQL identifier: "${id}"`);
    }
    return id;
}

export class QueryBuilder<T extends object> {
    private wheres: WhereCondition[] = [];
    private joins: JoinClause[] = [];
    private orders: OrderClause[] = [];
    private selectColumns: string[] = ["*"];
    private groupByColumns: string[] = [];
    private limitValue?: number;
    private offsetValue?: number;
    private readonly meta: EntityMetadata;

    constructor(private readonly entityClass: new (...args: any[]) => T) {
        const meta = getEntityMetadata(entityClass);
        if (!meta) {
            throw new Error(
                `No @Entity metadata found for "${entityClass.name}". Did you forget to add @Entity() to it?`
            );
        }
        this.meta = meta;
    }

    private get table(): string {
        return this.meta.tableName;
    }

    select(...columns: string[]): this {
        this.selectColumns = columns.length > 0 ? columns.map(assertSafeIdentifier) : ["*"];
        return this;
    }

    where(column: string, operatorOrValue: WhereOperator | any, value?: any): this {
        const hasOperator = value !== undefined;
        this.wheres.push({
            type: "basic",
            connector: "AND",
            column: assertSafeIdentifier(column),
            operator: hasOperator ? (operatorOrValue as WhereOperator) : "=",
            value: hasOperator ? value : operatorOrValue
        });
        return this;
    }

    orWhere(column: string, operatorOrValue: WhereOperator | any, value?: any): this {
        const hasOperator = value !== undefined;
        this.wheres.push({
            type: "basic",
            connector: "OR",
            column: assertSafeIdentifier(column),
            operator: hasOperator ? (operatorOrValue as WhereOperator) : "=",
            value: hasOperator ? value : operatorOrValue,
        });
        return this;
    }

    whereIn(column: string, values: any[]): this {
        this.wheres.push({ type: "in", connector: "AND", column: assertSafeIdentifier(column), values });
        return this;
    }

    whereNotIn(column: string, values: any[]): this {
        this.wheres.push({ type: "notIn", connector: "AND", column: assertSafeIdentifier(column), values });
        return this;
    }

    whereNull(column: string): this {
        this.wheres.push({ type: "null", connector: "AND", column: assertSafeIdentifier(column) });
        return this;
    }

    whereNotNull(column: string): this {
        this.wheres.push({ type: "notNull", connector: "AND", column: assertSafeIdentifier(column) });
        return this;
    }

    /**
     * Execute raw SQL in a WHERE clause.
     *
     * SECURITY WARNING: Always use parameterized placeholders (?) for user input.
     * CORRECT:  whereRaw("column = ? AND status = ?", [userInput, "active"])
     * WRONG:    whereRaw("column = '" + userInput + "'")  // SQL INJECTION!
     */
    whereRaw(sql: string, params: any[] = []): this {
        this.wheres.push({ type: "raw", connector: "AND", sql, params });
        return this;
    }

    /**
     * Execute raw SQL in an OR WHERE clause.
     *
     * SECURITY WARNING: Always use parameterized placeholders (?) for user input.
     * CORRECT:  orWhereRaw("column = ?", [userInput])
     * WRONG:    orWhereRaw("column = '" + userInput + "'")  // SQL INJECTION!
     */
    orWhereRaw(sql: string, params: any[] = []): this {
        this.wheres.push({ type: "raw", connector: "OR", sql, params });
        return this;
    }

    join(table: string, leftColumn: string, operator: WhereOperator, rightColumn: string): this {
        this.joins.push({
            type: "INNER",
            table: assertSafeIdentifier(table),
            leftColumn: assertSafeIdentifier(leftColumn),
            operator,
            rightColumn: assertSafeIdentifier(rightColumn),
        });
        return this;
    }

    innerJoin(table: string, leftColumn: string, operator: WhereOperator, rightColumn: string): this {
        return this.join(table, leftColumn, operator, rightColumn);
    }

    leftJoin(table: string, leftColumn: string, operator: WhereOperator, rightColumn: string): this {
        this.joins.push({
            type: "LEFT",
            table: assertSafeIdentifier(table),
            leftColumn: assertSafeIdentifier(leftColumn),
            operator,
            rightColumn:assertSafeIdentifier(rightColumn),
        });
        return this;
    }

    rightJoin(table: string, leftColumn: string, operator: WhereOperator, rightColumn: string): this {
        this.joins.push({
            type: "RIGHT",
            table: assertSafeIdentifier(table),
            leftColumn: assertSafeIdentifier(leftColumn),
            operator,
            rightColumn: assertSafeIdentifier(rightColumn),
        });
        return this;
    }

    fullJoin(table: string, leftColumn: string, operator: WhereOperator, rightColumn: string): this {
        this.joins.push({
            type: "FULL",
            table: assertSafeIdentifier(table),
            leftColumn: assertSafeIdentifier(leftColumn),
            operator,
            rightColumn: assertSafeIdentifier(rightColumn),
        });
        return this;
    }

    orderBy(column: string, direction: "ASC" | "DESC" = "ASC"): this {
        this.orders.push({ column: assertSafeIdentifier(column), direction });
        return this;
    }

    groupBy(...columns: string[]): this {
        this.groupByColumns.push(...columns.map(assertSafeIdentifier));
        return this;
    }

    limit(n: number): this {
        this.limitValue = n;
        return this;
    }

    offset(n: number): this {
        this.offsetValue = n;
        return this;
    }

    private buildWhereClause(startParamIndex: number): { sql: string; params: any[] } {
        if (this.wheres.length === 0) return { sql: "", params: [] };

        const parts: string[] = [];
        const params: any[] = [];
        let paramIndex = startParamIndex;

        this.wheres.forEach((w, i) => {
            const connector = i === 0 ? "" : ` ${w.connector} `;
            const likeOp = getDatabaseDriver().dialect.likeOperator;

            switch (w.type) {
                case "basic":
                    parts.push(`${connector}${w.column} ${likeOp(w.operator!)} $${paramIndex++}`);
                    params.push(w.value);
                    break;
                case "in": {
                    if (!w.values || w.values.length === 0) {
                        parts.push(`${connector}FALSE`);
                        break;
                    }
                    const placeholders = w.values.map(() => `$${paramIndex++}`).join(", ");
                    parts.push(`${connector}${w.column} IN (${placeholders})`);
                    params.push(...w.values);
                    break;
                }
                case "notIn": {
                    if (!w.values || w.values.length === 0) {
                        parts.push(`${connector}TRUE`);
                        break;
                    }
                    const placeholders = w.values.map(() => `$${paramIndex++}`).join(", ");
                    parts.push(`${connector}${w.column} NOT IN (${placeholders})`);
                    params.push(...w.values);
                    break;
                }
                case "null":
                    parts.push(`${connector}${w.column} IS NULL`);
                    break;
                case "notNull":
                    parts.push(`${connector}${w.column} IS NOT NULL`);
                    break;
                case "raw": {
                    let sql = w.sql!;
                    const rawParams = w.params ?? [];
                    rawParams.forEach(() => { sql = sql.replace("?", `$${paramIndex++}`); });
                    parts.push(`${connector}${sql}`);
                    params.push(...rawParams);
                    break;
                }
            }
        });

        return { sql: ` WHERE ${parts.join("")}`, params };
    }

    private buildJoinClause(): string {
        let sql = "";
        this.joins.forEach((j) => {
            sql += ` ${j.type} JOIN ${j.table} ON ${j.leftColumn} ${j.operator} ${j.rightColumn}`;
        });
        return sql;
    }

    toSQL(): { sql: string; params: any[] } {
        let sql = `SELECT ${this.selectColumns.join(", ")} FROM ${this.table}`;
        sql += this.buildJoinClause();

        const { sql: whereSql, params } = this.buildWhereClause(1);
        sql += whereSql;

        if (this.groupByColumns.length > 0) {
            sql += ` GROUP BY ${this.groupByColumns.join(", ")}`;
        }

        if (this.orders.length > 0) {
            sql += ` ORDER BY ${this.orders.map((o) => `${o.column} ${o.direction}`).join(", ")}`;
        }

        let paramIndex = params.length + 1;
        if (this.limitValue !== undefined) {
            sql += ` LIMIT $${paramIndex++}`;
            params.push(this.limitValue);
        }
        if (this.offsetValue !== undefined) {
            sql += ` OFFSET $${paramIndex++}`;
            params.push(this.offsetValue);
        }

        return { sql, params };
    }

    async get(): Promise<T[]> {
        const { sql, params } = this.toSQL();
        const result = await getQueryRunner().query(sql, params);
        return result.rows.map((row: any) => hydrateEntity(this.entityClass, row));
    }

    async paginate(request: PageRequest): Promise<Page<T>> {
        request.sorts.forEach((sort) => {
            this.orders.push({ column: assertSafeIdentifier(sort.column), direction: sort.direction });
        });

        const savedSelectColumns = this.selectColumns;
        const countOverExpr = getDatabaseDriver().dialect.countOverExpression();
        this.selectColumns = [...savedSelectColumns, `${countOverExpr} AS __total_count__`];

        this.limit(request.size).offset(request.offset);
        const { sql, params } = this.toSQL();
        const result = await getQueryRunner().query(sql, params);
        this.selectColumns = savedSelectColumns;

        const rows = result.rows as Record<string, unknown>[];
        const totalElements = rows.length > 0 ? Number(rows[0].__total_count__ ?? 0) : 0;

        const cleanRows = rows.map((row) => {
            const { __total_count__, ...rest } = row;
            return rest;
        });

        const content = cleanRows.map((row) => hydrateEntity(this.entityClass, row));
        return buildPage(content, request, totalElements);
    }

    async first(): Promise<T | null> {
        this.limit(1);
        const rows = await this.get();
        return rows[0] ?? null;
    }

    async count(): Promise<number> {
        const savedColumns = this.selectColumns;
        this.selectColumns = ["COUNT(*) AS count"];
        const { sql, params } = this.toSQL();
        this.selectColumns = savedColumns;
        const result = await getQueryRunner().query(sql, params);
        return Number(result.rows[0].count);
    }

    async insert(data: Partial<T>): Promise<T> {
        const columns = this.meta.columns.filter((c) => (data as any)[c.propertyName] !== undefined);
        if (columns.length === 0) {
            throw new Error(`insert() called with no matching @Column properties for "${this.entityClass.name}"`);
        }
        const values = columns.map((c) => (data as any)[c.propertyName]);
        const columnNames = columns.map((c) => c.columnName);
        const pkColumn = this.meta.columns.find((c) => c.isPrimary)?.columnName ?? "id";

        const plan = getDatabaseDriver().dialect.buildInsertReturning({
            table: this.table,
            columnNames,
            values,
            pkColumn,
        });

        let lastResult: QueryResult = { rows: [], rowCount: 0 };
        for (const statement of plan.statements) {
            lastResult = await getQueryRunner().query(statement.sql, statement.params);
        }

        const insertedRow = lastResult.rows[0];
        return insertedRow ? hydrateEntity(this.entityClass, insertedRow) : (data as T);
    }

    async update(data: Partial<T>): Promise<number> {
        if (this.wheres.length === 0) {
            throw new Error(
                "update() requires at least one where() clause. Use .whereRaw('1=1') if you really intend to update every row."
            );
        }
        const columns = this.meta.columns.filter((c) => (data as any)[c.propertyName] !== undefined);
        if (columns.length === 0) {
            throw new Error(`update() called with no matching @Column properties for "${this.entityClass.name}"`);
        }
        const values = columns.map((c) => (data as any)[c.propertyName]);
        const setClause = columns.map((c, i) => `${c.columnName} = $${i + 1}`).join(", ");
        const { sql: whereSql, params: whereParams } = this.buildWhereClause(values.length + 1);
        const sql = `UPDATE ${this.table} SET ${setClause}${whereSql}`;
        const result = await getQueryRunner().query(sql, [...values, ...whereParams]);
        return result.rowCount ?? 0;
    }

    async delete(): Promise<number> {
        if (this.wheres.length === 0) {
            throw new Error(
                "delete() requires at least one where() clause. Use .whereRaw('1=1') if you really intend to delete every row."
            );
        }
        const { sql: whereSql, params } = this.buildWhereClause(1);
        const sql = `DELETE FROM ${this.table}${whereSql}`;
        const result = await getQueryRunner().query(sql, params);
        return result.rowCount ?? 0;
    }
}