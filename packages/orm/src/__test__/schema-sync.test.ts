import {
    Column,
    ColumnType,
    CreatedAtColumn,
    Entity,
    EntityMetadata,
    getDialect,
    getEntityMetadata,
    IntrospectedSchema,
    PrimaryGeneratedColumn,
    QueryResult,
    UpdatedAtColumn,
    diffSchema,
    syncSchema,
    validateSchema,
    SchemaValidationError,
} from "../index";

@Entity("sync_items")
class SyncItem {
    @PrimaryGeneratedColumn(ColumnType.UUID)
    id!: string;

    @Column({ type: ColumnType.VARCHAR })
    name!: string;

    @Column({ type: ColumnType.INTEGER })
    quantity!: number;

    @CreatedAtColumn()
    createdAt!: Date;

    @UpdatedAtColumn()
    updatedAt!: Date;
}

function entityMeta(): EntityMetadata {
    return getEntityMetadata(SyncItem)!;
}

function fakeActual(
    tables: Record<string, Record<string, { type: string; nullable?: boolean }>>
): IntrospectedSchema {
    return {
        clientName: "postgres",
        tables: new Map(
            Object.entries(tables).map(([key, cols]) => {
                const [schema, name] = key.split(".");
                return [
                    key,
                    {
                        schema,
                        name,
                        columns: new Map(
                            Object.entries(cols).map(([colName, def]) => [
                                colName,
                                { name: colName, baseType: def.type, nullable: def.nullable ?? true },
                            ])
                        ),
                        foreignKeys: new Map(),
                        indexes: new Set<string>(),
                    },
                ];
            })
        ),
    };
}

class FakeDriver {
    readonly clientName = "postgres" as const;
    readonly dialect = getDialect("postgres");
    queries: string[] = [];
    private cannedResults: QueryResult[] = [];

    queue(result: QueryResult): void {
        this.cannedResults.push(result);
    }

    async query(sql: string): Promise<QueryResult> {
        this.queries.push(sql);
        return this.cannedResults.shift() ?? { rows: [], rowCount: 0 };
    }

    async connect(): Promise<void> {}
    async close(): Promise<void> {}
}

const postgres = getDialect("postgres");

describe("diffSchema", () => {
    it("detects missing tables", () => {
        const actual = fakeActual({});
        const diff = diffSchema([entityMeta()], actual, postgres);
        expect(diff.missingTables.map((t) => `${t.schemaName}.${t.tableName}`)).toEqual(["public.sync_items"]);
    });

    it("detects missing columns", () => {
        const actual = fakeActual({
            "public.sync_items": {
                id: { type: "uuid", nullable: false },
                name: { type: "character varying" },
            },
        });
        const diff = diffSchema([entityMeta()], actual, postgres);

        expect(diff.columnChanges.filter((c) => c.reason === "missing").map((c) => c.columnName)).toEqual([
            "quantity",
            "created_at",
            "updated_at",
        ]);
        // fake "name" column defaults to nullable while the entity requires NOT NULL
        expect(diff.columnChanges).toContainEqual(
            expect.objectContaining({ reason: "nullability-mismatch", columnName: "name" })
        );
        expect(diff.columnChanges).toHaveLength(4);
    });

    it("detects type mismatches", () => {
        const actual = fakeActual({
            "public.sync_items": {
                id: { type: "uuid", nullable: false },
                name: { type: "integer", nullable: false },
                quantity: { type: "integer", nullable: false },
                created_at: { type: "timestamp with time zone", nullable: false },
                updated_at: { type: "timestamp with time zone", nullable: false },
            },
        });
        const diff = diffSchema([entityMeta()], actual, postgres);

        expect(diff.columnChanges).toEqual([
            expect.objectContaining({
                reason: "type-mismatch",
                columnName: "name",
                detail: expect.stringContaining("expected varchar"),
            }),
        ]);
    });

    it("detects nullability mismatches on required columns", () => {
        const actual = fakeActual({
            "public.sync_items": {
                id: { type: "uuid", nullable: false },
                name: { type: "character varying", nullable: true },
                quantity: { type: "integer", nullable: false },
                created_at: { type: "timestamp with time zone", nullable: false },
                updated_at: { type: "timestamp with time zone", nullable: false },
            },
        });
        const diff = diffSchema([entityMeta()], actual, postgres);

        expect(diff.columnChanges).toEqual([
            expect.objectContaining({ reason: "nullability-mismatch", columnName: "name" }),
        ]);
    });

    it("reports no drift when schema matches exactly", () => {
        const actual = fakeActual({
            "public.sync_items": {
                id: { type: "uuid", nullable: false },
                name: { type: "character varying", nullable: false },
                quantity: { type: "integer", nullable: false },
                created_at: { type: "timestamp with time zone", nullable: false },
                updated_at: { type: "timestamp with time zone", nullable: false },
            },
        });
        const diff = diffSchema([entityMeta()], actual, postgres);

        expect(diff.missingTables).toHaveLength(0);
        expect(diff.columnChanges).toHaveLength(0);
    });
});

describe("validateSchema", () => {
    it("throws SchemaValidationError when drift exists", async () => {
        const driver = new FakeDriver();
        // introspectPostgres first lists tables (empty), so table is missing
        await expect(validateSchema(driver as never, [entityMeta()], ["public"])).rejects.toThrow(
            SchemaValidationError
        );
    });
});

describe("syncSchema update mode", () => {
    it("creates missing tables and indexes when nothing exists", async () => {
        const driver = new FakeDriver();

        const diff = await syncSchema(driver as never, "update", [entityMeta()], ["public"], postgres);

        expect(diff.statements.length).toBeGreaterThan(0);
        expect(diff.statements.join("\n")).toContain("CREATE TABLE");
        // 3 introspection queries run first, then the DDL statements
        expect(driver.queries.slice(3)).toEqual(diff.statements);
    });

    it("adds missing columns when table exists with partial drift", async () => {
        const driver = new FakeDriver();
        driver.queue({
            rows: [
                {
                    table_schema: "public",
                    table_name: "sync_items",
                    column_name: "id",
                    udt_name: "uuid",
                    data_type: "uuid",
                    is_nullable: "NO",
                },
                {
                    table_schema: "public",
                    table_name: "sync_items",
                    column_name: "name",
                    udt_name: "varchar",
                    data_type: "character varying",
                    character_maximum_length: 255,
                    is_nullable: "NO",
                },
            ],
            rowCount: 2,
        });
        driver.queue({ rows: [], rowCount: 0 }); // foreign keys
        driver.queue({ rows: [], rowCount: 0 }); // indexes

        const diff = await syncSchema(driver as never, "update", [entityMeta()], ["public"], postgres);

        const ddl = diff.statements.join("\n");
        expect(ddl).toContain("ADD COLUMN quantity");
        expect(ddl).toContain("ADD COLUMN created_at");
        expect(ddl).toContain("ADD COLUMN updated_at");
        expect(diff.missingTables).toHaveLength(0);
    });
});

describe("SAFE_TABLE regex for SQLite introspection", () => {
    const SAFE_TABLE = /^[a-zA-Z0-9_]+$/;

    it("accepts valid table names", () => {
        expect(SAFE_TABLE.test("users")).toBe(true);
        expect(SAFE_TABLE.test("user_accounts")).toBe(true);
        expect(SAFE_TABLE.test("order_items")).toBe(true);
        expect(SAFE_TABLE.test("Table123")).toBe(true);
    });

    it("rejects table names with SQL injection characters", () => {
        expect(SAFE_TABLE.test("users; DROP TABLE")).toBe(false);
        expect(SAFE_TABLE.test("users' OR 1=1")).toBe(false);
        expect(SAFE_TABLE.test("users`test`")).toBe(false);
        expect(SAFE_TABLE.test("users--comment")).toBe(false);
    });

    it("rejects empty string", () => {
        expect(SAFE_TABLE.test("")).toBe(false);
    });

    it("rejects table names with spaces", () => {
        expect(SAFE_TABLE.test("my table")).toBe(false);
    });

    it("rejects table names with special characters", () => {
        expect(SAFE_TABLE.test("users@test")).toBe(false);
        expect(SAFE_TABLE.test("table.name")).toBe(false);
    });
});
