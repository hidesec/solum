# @solumjs/orm

Entity decorators, query builder, relations, schema builder, and multi-database support.

## Install

```bash
npm install @solumjs/orm
```

## Entity Definition

```typescript
import { Entity, Column, ColumnType, PrimaryGeneratedColumn, CreatedAtColumn, UpdatedAtColumn, VersionColumn, Index, ManyToOne, OneToMany, OneToOne, ManyToMany } from "@solumjs/orm";

@Entity("users")
@Index("idx_users_email", ["email"], { unique: true })
export class User {

    @PrimaryGeneratedColumn(ColumnType.UUID)
    public readonly id!: string;

    @Column({ type: ColumnType.VARCHAR, length: 255 })
    public name!: string;

    @Column({ type: ColumnType.VARCHAR, length: 255, unique: true })
    public email!: string;

    @Column({ type: ColumnType.VARCHAR, length: 255, nullable: true })
    public passwordHash?: string;

    @Column({ type: ColumnType.VARCHAR, length: 32, default: "'USER'" })
    public role!: string;

    @VersionColumn()
    public version!: number;

    @CreatedAtColumn()
    public readonly createdAt!: Date;

    @UpdatedAtColumn()
    public readonly updatedAt!: Date;

    @OneToMany(() => Post, (post) => post.author)
    public posts?: Post[];
}
```

## Column Types

```typescript
import { ColumnType } from "@solumjs/orm";

// String
ColumnType.VARCHAR, ColumnType.CHAR, ColumnType.TEXT

// Number
ColumnType.SMALLINT, ColumnType.INTEGER, ColumnType.BIGINT
ColumnType.DECIMAL, ColumnType.NUMERIC, ColumnType.REAL, ColumnType.DOUBLE
ColumnType.SERIAL, ColumnType.BIGSERIAL

// Boolean
ColumnType.BOOLEAN

// Date/Time
ColumnType.DATE, ColumnType.TIME, ColumnType.TIMESTAMP, ColumnType.TIMESTAMPTZ, ColumnType.INTERVAL

// Special
ColumnType.UUID, ColumnType.JSON, ColumnType.JSONB, ColumnType.BYTEA
ColumnType.INET, ColumnType.CIDR, ColumnType.TEXT_ARRAY, ColumnType.INTEGER_ARRAY
ColumnType.ENUM
```

## Lifecycle Callbacks

```typescript
import { PrePersist, PostPersist, PreUpdate, PostUpdate, PreRemove, PostRemove, PostLoad } from "@solumjs/orm";

@Entity("users")
export class User {
    @PrePersist
    onPrePersist() { /* before insert */ }

    @PostPersist
    onPostPersist() { /* after insert */ }

    @PreUpdate
    onPreUpdate() { /* before update */ }

    @PostUpdate
    onPostUpdate() { /* after update */ }

    @PreRemove
    onPreRemove() { /* before delete */ }

    @PostRemove
    onPostRemove() { /* after delete */ }

    @PostLoad
    onPostLoad() { /* after hydration */ }
}
```

## Relations

```typescript
import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, OneToMany, OneToOne, ManyToMany, JoinColumn } from "@solumjs/orm";

@Entity("posts")
export class Post {
    @PrimaryGeneratedColumn(ColumnType.UUID)
    public readonly id!: string;

    @ManyToOne(() => User, (user) => user.posts)
    public author?: User;

    @OneToOne(() => Profile, (profile) => profile.user)
    @JoinColumn()
    public profile?: Profile;

    @ManyToMany(() => Tag)
    public tags?: Tag[];
}
```

## Query Builder

```typescript
// From repository
const users = await this.query()
    .where("role", "ADMIN")
    .andWhere("createdAt", ">", new Date("2024-01-01"))
    .orderBy("name", "ASC")
    .limit(10)
    .offset(0)
    .all();

// First result
const user = await this.query()
    .where("email", "john@example.com")
    .first();

// With joins
const posts = await this.query()
    .join("author", "users.id", "posts.authorId")
    .where("users.role", "ADMIN")
    .all();

// Pagination (single query with COUNT(*) OVER())
const page = await this.query().paginate({ page: 1, size: 20, sorts: [] });

// Raw query
const result = await this.raw("SELECT * FROM users WHERE email = $1", ["john@example.com"]);

// Count
const count = await this.query().where("role", "USER").count();
```

## Schema Sync

```typescript
import { SchemaSync } from "@solumjs/orm";

const sync = new SchemaSync(driver, [User, Product, Order]);

// Validate (drift detection)
const result = await sync.validate();
if (!result.ok) {
    for (const diff of result.diffs) console.error(diff);
}

// Auto-update schema
await sync.update();
```

## Schema Builder

```typescript
import { SchemaBuilder } from "@solumjs/orm";

const builder = new SchemaBuilder();
const sql = builder.buildCreateTableSQL(User);
```

## Transaction Context

```typescript
import { runInTransactionContext, getActiveTransactionClient } from "@solumjs/orm";

// Used internally by @Transactional
```

## Database Dialects

The ORM supports 5 database dialects via `@solumjs/database`:
- PostgreSQL
- MySQL
- SQLite
- MSSQL
- Oracle

## License

MIT
