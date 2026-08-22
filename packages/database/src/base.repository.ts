import {
    ColumnMetadata, EntityMetadata, ForeignKeyMetadata, RelationInfo,
    getEntityMetadata, hydrateEntity,
    runLifecycleCallbacks,
} from "@solumjs/orm";
import { bindPredicates, isDerivedQueryName, parseDerivedMethodName } from "@solumjs/orm";
import { RelationLoader } from "@solumjs/orm";
import { QueryBuilder } from "@solumjs/orm";
import { getDatabaseDriver, getQueryRunner } from "@solumjs/orm";
import { IBaseRepository } from "./base-repository.interface";
import { OptimisticLockException } from "./optimistic-lock.exception";
import { QueryResult } from "@solumjs/orm";
import { Page, PageRequest } from "@solumjs/http";

export abstract class BaseRepository<T extends object, ID = string> implements IBaseRepository<T, ID> {
    protected abstract readonly entityCtor: new (...args: any[]) => T;
    private _relationLoader?: RelationLoader<T>;

    constructor() {
        return new Proxy(this, {
            get: (target, prop, receiver) => {
                const value = Reflect.get(target, prop, receiver);
                if (value !== undefined || typeof prop !== "string") {
                    return value;
                }
                if (isDerivedQueryName(prop)) {
                    return (...args: unknown[]) => target.executeDerivedQuery(prop, args);
                }
                return value;
            },
        }) as this;
    }

    private async executeDerivedQuery(methodName: string, args: unknown[]): Promise<unknown> {
        const parsed = parseDerivedMethodName(methodName, this.meta);
        const conditions = bindPredicates(parsed.predicates, args);
        const qb = this.query();

        for (const condition of conditions) {
            if (condition.connector === "OR") {
                qb.orWhereRaw(condition.sql, condition.params);
            } else {
                qb.whereRaw(condition.sql, condition.params);
            }
        }

        switch (parsed.action) {
            case "find": {
                for (const order of parsed.orders) {
                    qb.orderBy(order.columnName, order.direction);
                }
                return this.runHydrated(qb);
            }
            case "findOne":
            case "findFirst": {
                for (const order of parsed.orders) {
                    qb.orderBy(order.columnName, order.direction);
                }
                qb.limit(1);
                const [entity] = await this.runHydrated(qb);
                return entity ?? null;
            }
            case "count":
                return qb.count();
            case "exists":
                return (await qb.count()) > 0;
            case "delete":
                return qb.delete();
        }
    }

    private async runHydrated(qb: QueryBuilder<T>): Promise<T[]> {
        const { sql, params } = qb.toSQL();
        const result = await getQueryRunner().query(sql, params);
        return this.hydrateRows(result.rows);
    }

    protected get meta(): EntityMetadata {
        const meta = getEntityMetadata(this.entityCtor);
        if (!meta) throw new Error(`No @Entity metadata found for "${this.entityCtor.name}". Did you forget to add @Entity() to it?`);
        return meta;
    }

    protected get qualifiedTable(): string {
        return getDatabaseDriver().dialect.qualifyTable(this.meta.schemaName, this.meta.tableName);
    }

    protected get primaryColumn(): ColumnMetadata {
        const pk = this.meta.columns.find((c) => c.isPrimary);
        if (!pk) throw new Error(`Entity "${this.entityCtor.name}" has no primary column. Add @PrimaryGeneratedColumn() or @PrimaryColumn().`);
        return pk;
    }

    private get persistableColumns(): (ColumnMetadata | ForeignKeyMetadata)[] {
        return [...this.meta.columns, ...this.meta.foreignKeys];
    }

    private get relationLoader(): RelationLoader<T> {
        if (!this._relationLoader) this._relationLoader = new RelationLoader(this.entityCtor);
        return this._relationLoader;
    }

    protected mapRow(row: Record<string, any>): T {
        return hydrateEntity(this.entityCtor, row);
    }

    protected query(): QueryBuilder<T> {
        return new QueryBuilder(this.entityCtor);
    }

    async findPage(request: PageRequest): Promise<Page<T>> {
        return this.query().paginate(request);
    }

    protected async raw<R = any>(sql: string, params: any[] = []): Promise<R[]> {
        const result = await getQueryRunner().query(sql, params);
        return result.rows;
    }

    protected async rawOne<R = any>(sql: string, params: any[] = []): Promise<R | null> {
        const rows = await this.raw<R>(sql, params);
        return rows[0] ?? null;
    }

    private async hydrateRows(rows: Record<string, any>[]): Promise<T[]> {
        if (rows.length === 0) return [];
        const eagerRelations = this.meta.relations.filter((r) => r.fetch === "EAGER");
        if (eagerRelations.length > 0) {
            await this.relationLoader.attach(rows, eagerRelations.map((r) => r.propertyName));
        }
        return rows.map((row) => this.hydrateSingle(row));
    }

    private hydrateSingle(row: Record<string, any>): T {
        const entity = hydrateEntity(this.entityCtor, row);

        this.meta.relations.forEach((relation) => {
            if (relation.fetch === "EAGER") {
                (entity as any)[relation.propertyName] = this.toEntityValue(relation, row[relation.propertyName]);
                return;
            }
            let cached: Promise<unknown> | undefined;
            Object.defineProperty(entity, relation.propertyName, {
                enumerable: true,
                configurable: true,
                get: () => {
                    if (!cached) cached = this.loadLazyRelation(row, relation);
                    return cached;
                },
            });
        });

        return entity;
    }

    private async loadLazyRelation(row: Record<string, any>, relation: RelationInfo): Promise<unknown> {
        const rowCopy = { ...row };
        await this.relationLoader.attach([rowCopy], [relation.propertyName]);
        return this.toEntityValue(relation, rowCopy[relation.propertyName]);
    }

    private toEntityValue(relation: RelationInfo, raw: unknown): unknown {
        const targetCtor = relation.targetEntity() as new (...args: any[]) => object;
        if (relation.type === "OneToMany" || relation.type === "ManyToMany") {
            return Array.isArray(raw) ? raw.map((r) => hydrateEntity(targetCtor, r)) : [];
        }
        return raw ? hydrateEntity(targetCtor, raw as Record<string, any>) : null;
    }

    async findById(id: ID): Promise<T | null> {
        const pk = this.primaryColumn;
        const result = await getQueryRunner().query(`SELECT * FROM ${this.qualifiedTable} WHERE ${pk.columnName} = $1`, [id]);
        const [entity] = await this.hydrateRows(result.rows);
        return entity ?? null;
    }

    async findAll(): Promise<T[]> {
        const result = await getQueryRunner().query(`SELECT * FROM ${this.qualifiedTable}`);
        return this.hydrateRows(result.rows);
    }

    async findAllById(ids: ID[]): Promise<T[]> {
        if (ids.length === 0) return [];
        const pk = this.primaryColumn;
        const placeholders = ids.map((_, i) => `$${i + 1}`).join(", ");
        const result = await getQueryRunner().query(
            `SELECT * FROM ${this.qualifiedTable} WHERE ${pk.columnName} IN (${placeholders})`,
            ids
        );
        return this.hydrateRows(result.rows);
    }

    async existsById(id: ID): Promise<boolean> {
        const pk = this.primaryColumn;
        const result = await getQueryRunner().query(`SELECT 1 FROM ${this.qualifiedTable} WHERE ${pk.columnName} = $1 LIMIT 1`, [id]);
        return (result.rowCount ?? 0) > 0;
    }

    async count(): Promise<number> {
        const countExpr = getDatabaseDriver().dialect.countExpression();
        const result = await getQueryRunner().query(`SELECT ${countExpr} AS count FROM ${this.qualifiedTable}`);
        return Number(result.rows[0].count);
    }

    private applyTimestamps(entity: T): void {
        const now = new Date();
        this.meta.columns.forEach((col) => {
            if (col.isCreatedAt && (entity as any)[col.propertyName] === undefined) {
                (entity as any)[col.propertyName] = now;
            }
            if (col.isUpdatedAt) {
                (entity as any)[col.propertyName] = now;
            }
        });
    }

    async save(entity: T): Promise<T> {
        const pk = this.primaryColumn;
        const versionColumn = this.meta.columns.find((c) => c.isVersion);
        const id = (entity as any)[pk.propertyName];
        const isNew = id === undefined || id === null;

        this.applyTimestamps(entity);

        if (versionColumn) {
            return this.saveWithVersion(entity, { pk, versionColumn, isNew });
        }

        runLifecycleCallbacks(entity, isNew ? "PrePersist" : "PreUpdate", this.entityCtor);

        const columns = this.persistableColumns;
        const insertColumnNames = columns.map((c) => c.columnName);
        const values = columns.map((c) => (entity as any)[c.propertyName]);
        const updatableColumns = columns.filter((c) => {
            const isPk = "isPrimary" in c && c.isPrimary;
            const isCreatedAt = "isCreatedAt" in c && c.isCreatedAt;
            return !isPk && !isCreatedAt;
        }).map((c) => c.columnName);

        const plan = getDatabaseDriver().dialect.buildUpsert({
            table: this.qualifiedTable,
            columnNames: insertColumnNames,
            values,
            pkColumn: pk.columnName,
            updatableColumns,
        });

        let lastResult: QueryResult = { rows: [], rowCount: 0 };
        for (const statement of plan.statements) {
            lastResult = await getQueryRunner().query(statement.sql, statement.params);
        }

        runLifecycleCallbacks(entity, isNew ? "PostPersist" : "PostUpdate", this.entityCtor);

        const savedRow = lastResult.rows[0];
        return savedRow ? this.mapRow(savedRow) : entity;
    }

    private async saveWithVersion(
        entity: T,
        context: { pk: ColumnMetadata; versionColumn: ColumnMetadata; isNew: boolean }
    ): Promise<T> {
        const { pk, versionColumn, isNew } = context;

        runLifecycleCallbacks(entity, isNew ? "PrePersist" : "PreUpdate", this.entityCtor);

        const persistable = this.persistableColumns.filter(
            (c) => !("isUpdatedAt" in c && c.isUpdatedAt)
        );

        if (isNew) {
            (entity as any)[versionColumn.propertyName] =
                (entity as any)[versionColumn.propertyName] ?? 0;

            const columnNames = persistable.map((c) => c.columnName);
            const values = persistable.map((c) => (entity as any)[c.propertyName]);

            const plan = getDatabaseDriver().dialect.buildInsertReturning({
                table: this.qualifiedTable,
                columnNames,
                values,
                pkColumn: pk.columnName,
            });

            let lastResult: QueryResult = { rows: [], rowCount: 0 };
            for (const statement of plan.statements) {
                lastResult = await getQueryRunner().query(statement.sql, statement.params);
            }

            runLifecycleCallbacks(entity, "PostPersist", this.entityCtor);

            const insertedRow = lastResult.rows[0];
            return insertedRow ? this.mapRow(insertedRow) : entity;
        }

        const expectedVersion = (entity as any)[versionColumn.propertyName];
        if (expectedVersion === undefined || expectedVersion === null) {
            throw new OptimisticLockException(this.entityCtor.name, (entity as any)[pk.propertyName], expectedVersion);
        }

        const updatable = persistable.filter((c) => {
            const isPk = "isPrimary" in c && c.isPrimary;
            const isCreatedAt = "isCreatedAt" in c && c.isCreatedAt;
            if (isPk || isCreatedAt) return false;
            return c.columnName !== versionColumn.columnName;
        });

        const setClauses = [
            ...updatable.map((c, i) => `${c.columnName} = $${i + 1}`),
            `${versionColumn.columnName} = ${versionColumn.columnName} + 1`,
        ];
        const params: unknown[] = updatable.map((c) => (entity as any)[c.propertyName]);

        const whereStart = setClauses.length + 1;
        const sql =
            `UPDATE ${this.qualifiedTable} SET ${setClauses.join(", ")} ` +
            `WHERE ${pk.columnName} = $${whereStart} AND ${versionColumn.columnName} = $${whereStart + 1} ` +
            `RETURNING *`;

        params.push((entity as any)[pk.propertyName], expectedVersion);

        const result = await getQueryRunner().query(sql, params);
        if ((result.rowCount ?? 0) === 0) {
            throw new OptimisticLockException(this.entityCtor.name, (entity as any)[pk.propertyName], expectedVersion);
        }

        runLifecycleCallbacks(entity, "PostUpdate", this.entityCtor);
        return this.mapRow(result.rows[0]);
    }

    async deleteById(id: ID): Promise<void> {
        const pk = this.primaryColumn;
        await getQueryRunner().query(`DELETE FROM ${this.qualifiedTable} WHERE ${pk.columnName} = $1`, [id]);
    }

    async delete(entity: T): Promise<void> {
        const pk = this.primaryColumn;
        runLifecycleCallbacks(entity, "PreRemove", this.entityCtor);
        await this.deleteById((entity as any)[pk.propertyName]);
        runLifecycleCallbacks(entity, "PostRemove", this.entityCtor);
    }
}