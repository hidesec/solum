import {
    Column,
    ColumnType,
    Entity,
    getDialect,
    PostLoad,
    PostPersist,
    PostRemove,
    PostUpdate,
    PrePersist,
    PreRemove,
    PreUpdate,
    PrimaryGeneratedColumn,
    QueryResult,
    registerDatabaseDriver,
} from "@solumjs/orm";
import { BaseRepository } from "../base.repository";
import { IBaseRepository } from "../base-repository.interface";

interface LogEntry {
    event: string;
    self: object;
}

const lifecycleLog: LogEntry[] = [];
const eventsFor = (self: object): string[] =>
    lifecycleLog.filter((entry) => entry.self === self).map((entry) => entry.event);

@Entity("audit_docs")
class AuditDoc {
    @PrimaryGeneratedColumn(ColumnType.UUID)
    id!: string;

    @Column({ type: ColumnType.VARCHAR })
    title!: string;

    @PrePersist()
    onPrePersist(): void {
        lifecycleLog.push({ event: "PrePersist", self: this });
    }

    @PostPersist()
    onPostPersist(): void {
        lifecycleLog.push({ event: "PostPersist", self: this });
    }

    @PreUpdate()
    onPreUpdate(): void {
        lifecycleLog.push({ event: "PreUpdate", self: this });
    }

    @PostUpdate()
    onPostUpdate(): void {
        lifecycleLog.push({ event: "PostUpdate", self: this });
    }

    @PreRemove()
    onPreRemove(): void {
        lifecycleLog.push({ event: "PreRemove", self: this });
    }

    @PostRemove()
    onPostRemove(): void {
        lifecycleLog.push({ event: "PostRemove", self: this });
    }

    @PostLoad()
    onPostLoad(): void {
        lifecycleLog.push({ event: "PostLoad", self: this });
    }
}

class CapturingDriver {
    readonly clientName = "postgres" as const;
    readonly dialect = getDialect("postgres");
    queries: { sql: string; params: unknown[] }[] = [];
    private cannedResults: QueryResult[] = [];

    queue(result: QueryResult): void {
        this.cannedResults.push(result);
    }

    async query(sql: string, params: unknown[] = []): Promise<QueryResult> {
        this.queries.push({ sql, params });
        return this.cannedResults.shift() ?? { rows: [], rowCount: 0 };
    }

    async connect(): Promise<void> {}
    async close(): Promise<void> {}
    async transaction<T>(fn: (tx: unknown) => Promise<T>): Promise<T> {
        return fn({});
    }
}

class AuditRepository extends BaseRepository<AuditDoc, string> {
    protected readonly entityCtor = AuditDoc;
    findById(): Promise<AuditDoc | null> {
        throw new Error("not implemented in test");
    }
    findAll(): Promise<AuditDoc[]> {
        throw new Error("not implemented in test");
    }
}

describe("entity lifecycle callbacks", () => {
    let driver: CapturingDriver;
    let repo: BaseRepository<AuditDoc, string>;

    beforeEach(() => {
        lifecycleLog.length = 0;
        driver = new CapturingDriver();
        registerDatabaseDriver(driver as never);
        repo = new AuditRepository();
    });

    it("fires PrePersist and PostPersist around inserts", async () => {
        driver.queue({ rows: [{ id: "uuid-1", title: "hello" }], rowCount: 1 });

        const doc = new AuditDoc();
        doc.title = "hello";

        await repo.save(doc);

        expect(eventsFor(doc)).toEqual(["PrePersist", "PostPersist"]);
        expect(driver.queries[0].sql).toContain("INSERT INTO public.audit_docs");
    });

    it("fires PreUpdate and PostUpdate around updates", async () => {
        driver.queue({ rows: [{ id: "uuid-1", title: "changed" }], rowCount: 1 });

        const doc = new AuditDoc();
        doc.id = "uuid-1";
        doc.title = "changed";

        await repo.save(doc);

        expect(eventsFor(doc)).toEqual(["PreUpdate", "PostUpdate"]);
        expect(driver.queries[0].sql).toContain("INSERT INTO public.audit_docs");
        expect(driver.queries[0].sql).toContain("ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title");
    });

    it("fires PostLoad when entities are hydrated from the database", async () => {
        driver.queue({
            rows: [
                { id: "uuid-2", title: "loaded" },
                { id: "uuid-3", title: "loaded too" },
            ],
            rowCount: 2,
        });

        const derived = repo as unknown as { findByTitle(t: string): Promise<AuditDoc[]> };
        const docs = await derived.findByTitle("loaded");

        expect(docs).toHaveLength(2);
        expect(docs[0].title).toBe("loaded");
        expect(lifecycleLog.filter((e) => e.event === "PostLoad")).toHaveLength(2);
        expect(lifecycleLog.filter((e) => e.event === "PostLoad").every((e) => docs.includes(e.self as AuditDoc)))
            .toBe(true);
    });

    it("fires PreRemove and PostRemove around deletes", async () => {
        driver.queue({ rows: [], rowCount: 1 });

        const doc = new AuditDoc();
        doc.id = "uuid-3";
        doc.title = "to delete";

        await repo.delete(doc);

        expect(eventsFor(doc)).toEqual(["PreRemove", "PostRemove"]);
    });

    it("propagates errors thrown by callbacks and skips the query", async () => {
        @Entity("guarded_docs")
        class GuardedDoc {
            @PrimaryGeneratedColumn(ColumnType.UUID)
            id!: string;

            @Column({ type: ColumnType.VARCHAR })
            title!: string;

            @PrePersist()
            guard(): void {
                throw new Error("guard rejected persist");
            }
        }

        class GuardedRepository extends BaseRepository<GuardedDoc, string> {
            protected readonly entityCtor = GuardedDoc;
            findById(): Promise<GuardedDoc | null> {
                throw new Error("not implemented in test");
            }
            findAll(): Promise<GuardedDoc[]> {
                throw new Error("not implemented in test");
            }
        }

        registerDatabaseDriver(driver as never);
        const guardedRepo = new GuardedRepository();

        const doc = new GuardedDoc();
        doc.title = "blocked";

        await expect(guardedRepo.save(doc)).rejects.toThrow("guard rejected persist");
        expect(driver.queries).toHaveLength(0);
    });
});
