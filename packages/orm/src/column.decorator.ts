import "@solumjs/core";

export enum ColumnType {
  SMALLINT = "SMALLINT", INTEGER = "INTEGER", BIGINT = "BIGINT",
  DECIMAL = "DECIMAL", NUMERIC = "NUMERIC", REAL = "REAL", DOUBLE = "DOUBLE PRECISION",
  SERIAL = "SERIAL", BIGSERIAL = "BIGSERIAL",
  VARCHAR = "VARCHAR", CHAR = "CHAR", TEXT = "TEXT",
  BOOLEAN = "BOOLEAN",
  DATE = "DATE", TIME = "TIME", TIMESTAMP = "TIMESTAMP", TIMESTAMPTZ = "TIMESTAMPTZ", INTERVAL = "INTERVAL",
  UUID = "UUID",
  JSON = "JSON", JSONB = "JSONB",
  BYTEA = "BYTEA",
  INET = "INET", CIDR = "CIDR",
  TEXT_ARRAY = "TEXT[]", INTEGER_ARRAY = "INTEGER[]",
  ENUM = "ENUM",
}

export type FetchType = "EAGER" | "LAZY";

export interface RelationInfo {
  propertyName: string;
  type: "ManyToOne" | "OneToMany" | "OneToOne" | "ManyToMany";
  targetEntity: () => Function;
  fetch: FetchType;
}

export interface ColumnOptions {
  type: ColumnType;
  length?: number;
  precision?: number;
  scale?: number;
  nullable?: boolean;
  unique?: boolean;
  default?: string;
  enumValues?: string[];
  comment?: string;
}

export interface ColumnMetadata extends ColumnOptions {
  propertyName: string;
  columnName: string;
  isPrimary?: boolean;
  isCreatedAt?: boolean;
  isUpdatedAt?: boolean;
  isVersion?: boolean;
}

export type CascadeAction = "CASCADE" | "SET NULL" | "RESTRICT" | "NO ACTION";

export interface ForeignKeyMetadata {
  propertyName: string;
  columnName: string;
  referencedTable: string;
  referencedColumn: string;
  onDelete: CascadeAction;
  nullable: boolean;
  unique?: boolean;
}

export interface ManyToManyMetadata {
  propertyName: string;
  targetEntity: () => Function;
  joinTable?: string;
  joinColumn?: string;
  inverseJoinColumn?: string;
}

export interface RelationInfo {
  propertyName: string;
  type: "ManyToOne" | "OneToMany" | "OneToOne" | "ManyToMany";
  targetEntity: () => Function;
}

export interface EntityMetadata {
  tableName: string;
  schemaName: string;
  target: Function;
  columns: ColumnMetadata[];
  foreignKeys: ForeignKeyMetadata[];
  manyToMany: ManyToManyMetadata[];
  relations: RelationInfo[];
  indexes: IndexMetadata[];
}

export interface IndexMetadata {
    name?: string;
    columns:string[];
    unique?: boolean;
}

export type LifecycleEvent =
  | "PrePersist"
  | "PostPersist"
  | "PreUpdate"
  | "PostUpdate"
  | "PreRemove"
  | "PostRemove"
  | "PostLoad";

const LIFECYCLE_KEY = "custom:entity-lifecycle";

const ENTITIES: Map<Function, EntityMetadata> = new Map();

function toSnakeCase(str: string): string {
  return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

function defaultTableName(className: string): string {
  return `${toSnakeCase(className)}s`;
}

function getOrCreateEntity(ctor: Function): EntityMetadata {
  let entity = ENTITIES.get(ctor);
  if (!entity) {
    entity = {
      tableName: defaultTableName(ctor.name),
      schemaName: "public",
      target: ctor,
      columns: [],
      foreignKeys: [],
      manyToMany: [],
      relations: [],
      indexes: [],
    };
    ENTITIES.set(ctor, entity);
  }
  return entity;
}

export interface EntityOptions {
  name?: string;
  schema?: string;
}

export function Entity(options?: string | EntityOptions) {
  return function (target: Function) {
    const entity = getOrCreateEntity(target);
    if (typeof options === "string") {
      entity.tableName = options;
    } else if (options) {
      if (options.name) entity.tableName = options.name;
      if (options.schema) entity.schemaName = options.schema;
    }
  };
}

export function Schema(schemaName: string) {
  return function (target: Function) {
    getOrCreateEntity(target).schemaName = schemaName;
  };
}

function addColumn(target: any, propertyName: string, meta: Partial<ColumnMetadata>): void {
  const entity = getOrCreateEntity(target.constructor);
  entity.columns.push({
    propertyName,
    columnName: meta.columnName ?? toSnakeCase(propertyName),
    type: meta.type ?? ColumnType.TEXT,
    length: meta.length,
    precision: meta.precision,
    scale: meta.scale,
    nullable: meta.nullable ?? false,
    unique: meta.unique ?? false,
    default: meta.default,
    enumValues: meta.enumValues,
    comment: meta.comment,
    isPrimary: meta.isPrimary ?? false,
    isCreatedAt: meta.isCreatedAt ?? false,
    isUpdatedAt: meta.isUpdatedAt ?? false,
    isVersion: meta.isVersion ?? false,
  });
}

export function Column(options: ColumnOptions) {
  return function (target: any, propertyName: string) {
    if (options.type === ColumnType.ENUM && (!options.enumValues || options.enumValues.length === 0)) {
      throw new Error(`@Column ENUM type on "${propertyName}" requires enumValues array`);
    }
    addColumn(target, propertyName, options);
  };
}

export function PrimaryGeneratedColumn(
  type: ColumnType.UUID | ColumnType.SERIAL | ColumnType.BIGSERIAL = ColumnType.UUID
) {
  return function (target: any, propertyName: string) {
    addColumn(target, propertyName, {
      type,
      isPrimary: true,
      default: type === ColumnType.UUID ? "gen_random_uuid()" : undefined,
    });
  };
}

export function PrimaryColumn(type: ColumnType = ColumnType.VARCHAR, length?: number) {
  return function (target: any, propertyName: string) {
    addColumn(target, propertyName, { type, length, isPrimary: true });
  };
}

export function CreatedAtColumn() {
  return function (target: any, propertyName: string) {
    addColumn(target, propertyName, { type: ColumnType.TIMESTAMPTZ, isCreatedAt: true, default: "now()" });
  };
}

export function UpdatedAtColumn() {
  return function (target: any, propertyName: string) {
    addColumn(target, propertyName, { type: ColumnType.TIMESTAMPTZ, isUpdatedAt: true, default: "now()" });
  };
}

export function VersionColumn(type: ColumnType.INTEGER | ColumnType.BIGINT = ColumnType.INTEGER) {
  return function (target: any, propertyName: string) {
    addColumn(target, propertyName, { type, isVersion: true, default: "0" });
  };
}

function addLifecycleListener(target: object, event: LifecycleEvent, methodName: string): void {
  const ctor = target.constructor ?? target;
  const existing = (Reflect.getOwnMetadata(LIFECYCLE_KEY, ctor) as Partial<Record<LifecycleEvent, string[]>>) ?? {};
  existing[event] = [...(existing[event] ?? []), methodName];
  Reflect.defineMetadata(LIFECYCLE_KEY, existing, ctor);
}

function lifecycleDecorator(event: LifecycleEvent): MethodDecorator {
  return (target, propertyKey) => {
    addLifecycleListener(target, event, String(propertyKey));
  };
}

export const PrePersist = (): MethodDecorator => lifecycleDecorator("PrePersist");
export const PostPersist = (): MethodDecorator => lifecycleDecorator("PostPersist");
export const PreUpdate = (): MethodDecorator => lifecycleDecorator("PreUpdate");
export const PostUpdate = (): MethodDecorator => lifecycleDecorator("PostUpdate");
export const PreRemove = (): MethodDecorator => lifecycleDecorator("PreRemove");
export const PostRemove = (): MethodDecorator => lifecycleDecorator("PostRemove");
export const PostLoad = (): MethodDecorator => lifecycleDecorator("PostLoad");

export function getLifecycleMethods(target: Function, event: LifecycleEvent): string[] {
  const map = Reflect.getOwnMetadata(LIFECYCLE_KEY, target) as
    | Partial<Record<LifecycleEvent, string[]>>
    | undefined;
  return map?.[event] ?? [];
}

export function runLifecycleCallbacks(
  entity: object,
  event: LifecycleEvent,
  ctor?: Function
): void {
  const target = ctor ?? Object.getPrototypeOf(entity)?.constructor;
  if (!target) return;
  for (const methodName of getLifecycleMethods(target, event)) {
    const method = (entity as any)[methodName];
    if (typeof method !== "function") {
      throw new Error(`@${event} callback "${methodName}" not found on entity "${target.name}"`);
    }
    method.call(entity);
  }
}

function tableNameOf(entityFn: () => Function): string {
  const target = entityFn();
  const meta = ENTITIES.get(target);
  return meta ? meta.tableName : defaultTableName(target.name);
}

export function ManyToOne(
  targetEntity: () => Function,
  options?: { onDelete?: CascadeAction; nullable?: boolean; joinColumn?: string; fetch?: FetchType }
) {
  return function (target: any, propertyName: string) {
    const entity = getOrCreateEntity(target.constructor);
    const columnName = options?.joinColumn ?? `${toSnakeCase(propertyName)}_id`;
    entity.foreignKeys.push({
      propertyName, columnName, referencedTable: "", referencedColumn: "id",
      onDelete: options?.onDelete ?? "RESTRICT", nullable: options?.nullable ?? false,
    });
    entity.relations.push({ propertyName, type: "ManyToOne", targetEntity, fetch: options?.fetch ?? "EAGER" });
    (entity.foreignKeys[entity.foreignKeys.length - 1] as any)._resolveTable = () => tableNameOf(targetEntity);
  };
}

export function OneToMany(targetEntity: () => Function, _inverseSide?: string, options?: { fetch?: FetchType }) {
  return function (target: any, propertyName: string) {
    const entity = getOrCreateEntity(target.constructor);
    entity.relations.push({ propertyName, type: "OneToMany", targetEntity, fetch: options?.fetch ?? "LAZY" });
  };
}

export function OneToOne(
  targetEntity: () => Function,
  options?: { onDelete?: CascadeAction; nullable?: boolean; joinColumn?: string; fetch?: FetchType }
) {
  return function (target: any, propertyName: string) {
    const entity = getOrCreateEntity(target.constructor);
    const columnName = options?.joinColumn ?? `${toSnakeCase(propertyName)}_id`;
    entity.foreignKeys.push({
      propertyName, columnName, referencedTable: "", referencedColumn: "id",
      onDelete: options?.onDelete ?? "CASCADE", nullable: options?.nullable ?? true, unique: true,
    });
    entity.relations.push({ propertyName, type: "OneToOne", targetEntity, fetch: options?.fetch ?? "EAGER" });
    (entity.foreignKeys[entity.foreignKeys.length - 1] as any)._resolveTable = () => tableNameOf(targetEntity);
  };
}

export function ManyToMany(
  targetEntity: () => Function,
  options?: { joinTable?: string; joinColumn?: string; inverseJoinColumn?: string; fetch?: FetchType }
) {
  return function (target: any, propertyName: string) {
    const entity = getOrCreateEntity(target.constructor);
    entity.manyToMany.push({
      propertyName, targetEntity,
      joinTable: options?.joinTable, joinColumn: options?.joinColumn, inverseJoinColumn: options?.inverseJoinColumn,
    });
    entity.relations.push({ propertyName, type: "ManyToMany", targetEntity, fetch: options?.fetch ?? "LAZY" });
  };
}

export function Index(columns: string | string[], options?: { unique?: boolean; name?: string }) {
    return function (target: Function) {
        const entity = getOrCreateEntity(target);
        const cols = Array.isArray(columns) ? columns : [columns];
        entity.indexes.push({
            name:options?.name,
            columns: cols.map(toSnakeCase),
            unique: options?.unique ?? false,
        });
    }
}

export function getEntityMetadata(target: Function): EntityMetadata | undefined {
  return ENTITIES.get(target);
}

export function getAllEntities(): EntityMetadata[] {
  return Array.from(ENTITIES.values());
}

export function hydrateEntity<T extends object>(ctor: new (...args: any[]) => T, row: Record<string, any>): T {
  const meta = getEntityMetadata(ctor);
  if (!meta) {
    throw new Error(`No @Entity metadata found for "${ctor.name}". Did you forget to add @Entity() to it?`);
  }
  const instance = Object.create(ctor.prototype) as T;
  meta.columns.forEach((col) => { (instance as any)[col.propertyName] = row[col.columnName]; });
  meta.foreignKeys.forEach((fk) => { (instance as any)[fk.propertyName] = row[fk.columnName]; });
  runLifecycleCallbacks(instance, "PostLoad", ctor);
  return instance;
}