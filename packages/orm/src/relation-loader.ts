import { getQueryRunner } from "./transaction-context";
import { EntityMetadata, RelationInfo, getEntityMetadata } from "./column.decorator";

type RawRow = Record<string, any>;

export class RelationLoader<T extends object> {
  constructor(private readonly entityCtor: new (...args: any[]) => T) {}

  private get meta(): EntityMetadata {
    const meta = getEntityMetadata(this.entityCtor);
    if (!meta) throw new Error(`No @Entity metadata found for ${this.entityCtor.name}`);
    return meta;
  }

  async attach(rows: RawRow[], relationNames: string[]): Promise<void> {
    if (rows.length === 0 || relationNames.length === 0) return;
    for (const relName of relationNames) {
      const relation = this.meta.relations.find((r) => r.propertyName === relName);
      if (!relation) { console.warn(`Relation "${relName}" not found on ${this.entityCtor.name}`); continue; }
      switch (relation.type) {
        case "ManyToOne":
        case "OneToOne": await this.attachToOne(rows, relation); break;
        case "OneToMany": await this.attachOneToMany(rows, relation); break;
        case "ManyToMany": await this.attachManyToMany(rows, relation); break;
      }
    }
  }

  private async attachToOne(rows: RawRow[], relation: RelationInfo): Promise<void> {
    const fk = this.meta.foreignKeys.find((f) => f.propertyName === relation.propertyName);
    if (!fk) return;
    const targetCtor = relation.targetEntity();
    const targetMeta = getEntityMetadata(targetCtor);
    if (!targetMeta) return;
    const ids = [...new Set(rows.map((r) => r[fk.columnName]).filter(Boolean))];
    if (ids.length === 0) return;
    const qualifiedTarget = `${targetMeta.schemaName}.${targetMeta.tableName}`;
    const result = await getQueryRunner().query(`SELECT * FROM ${qualifiedTarget} WHERE id = ANY($1)`, [ids]);
    const byId = new Map(result.rows.map((r: any) => [r.id, r]));
    rows.forEach((r) => { r[relation.propertyName] = byId.get(r[fk.columnName]) ?? null; });
  }

  private async attachOneToMany(rows: RawRow[], relation: RelationInfo): Promise<void> {
    const targetCtor = relation.targetEntity();
    const targetMeta = getEntityMetadata(targetCtor);
    if (!targetMeta) return;
    const inverseFk = targetMeta.foreignKeys.find((fk) => {
      const resolver = (fk as any)._resolveTable as (() => string) | undefined;
      const resolvedTable = resolver ? resolver() : fk.referencedTable;
      return resolvedTable === this.meta.tableName;
    });
    if (!inverseFk) { console.warn(`Cannot resolve inverse FK for OneToMany "${relation.propertyName}"`); return; }
    const parentIds = rows.map((r) => r.id).filter(Boolean);
    if (parentIds.length === 0) return;
    const qualifiedTarget = `${targetMeta.schemaName}.${targetMeta.tableName}`;
    const result = await getQueryRunner().query(
      `SELECT * FROM ${qualifiedTarget} WHERE ${inverseFk.columnName} = ANY($1)`, [parentIds]
    );
    const grouped = new Map<string, RawRow[]>();
    result.rows.forEach((row: any) => {
      const key = row[inverseFk.columnName];
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(row);
    });
    rows.forEach((r) => { r[relation.propertyName] = grouped.get(r.id) ?? []; });
  }

  private async attachManyToMany(rows: RawRow[], relation: RelationInfo): Promise<void> {
    const targetCtor = relation.targetEntity();
    const targetMeta = getEntityMetadata(targetCtor);
    if (!targetMeta) return;
    const m2m = this.meta.manyToMany.find((r) => r.propertyName === relation.propertyName);
    if (!m2m) return;
    const joinTable = m2m.joinTable ?? `${this.meta.tableName}_${targetMeta.tableName}`;
    const joinColumn = m2m.joinColumn ?? `${this.meta.tableName.replace(/s$/, "")}_id`;
    const inverseJoinColumn = m2m.inverseJoinColumn ?? `${targetMeta.tableName.replace(/s$/, "")}_id`;
    const qualifiedJoinTable = `${this.meta.schemaName}.${joinTable}`;
    const qualifiedTarget = `${targetMeta.schemaName}.${targetMeta.tableName}`;
    const parentIds = rows.map((r) => r.id).filter(Boolean);
    if (parentIds.length === 0) return;
    const result = await getQueryRunner().query(
      `SELECT jt.${joinColumn} AS parent_id, t.*
       FROM ${qualifiedJoinTable} jt
       JOIN ${qualifiedTarget} t ON t.id = jt.${inverseJoinColumn}
       WHERE jt.${joinColumn} = ANY($1)`, [parentIds]
    );
    const grouped = new Map<string, RawRow[]>();
    result.rows.forEach((row: any) => {
      const { parent_id, ...rest } = row;
      if (!grouped.has(parent_id)) grouped.set(parent_id, []);
      grouped.get(parent_id)!.push(rest);
    });
    rows.forEach((r) => { r[relation.propertyName] = grouped.get(r.id) ?? []; });
  }
}