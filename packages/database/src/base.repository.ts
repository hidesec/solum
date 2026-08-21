import {
    ColumnMetadata, EntityMetadata, ForeignKeyMetadata, RelationInfo,
    getEntityMetadata, hydrateEntity,
} from "@solumjs/orm";
import { RelationLoader } from "@solumjs/orm";
import { QueryBuilder } from "@solumjs/orm";
import { getDatabaseDriver, getQueryRunner } from "@solumjs/orm";
import { IBaseRepository } from "./base-repository.interface";
import { QueryResult } from "@solumjs/orm";
import { Page, PageRequest } from "@solumjs/http";

export abstract class BaseRepository<T extends object, ID = string> implements IBaseRepository<T, ID> {
    protected abstract readonly entityCtor: new (...args: any[]) => T;
    private _relationLoader?: RelationLoader<T>;

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
        this.applyTimestamps(entity);
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

        const savedRow = lastResult.rows[0];
        return savedRow ? this.mapRow(savedRow) : entity;
    }

    async deleteById(id: ID): Promise<void> {
        const pk = this.primaryColumn;
        await getQueryRunner().query(`DELETE FROM ${this.qualifiedTable} WHERE ${pk.columnName} = $1`, [id]);
    }

    async delete(entity: T): Promise<void> {
        const pk = this.primaryColumn;
        await this.deleteById((entity as any)[pk.propertyName]);
    }
}