# @solumjs/database

Repository pattern, transactions, migrations, and driver factory.

## Install

```bash
npm install @solumjs/database
```

## BaseRepository

```typescript
import { BaseRepository } from "@solumjs/database";
import { Bean, inject } from "@solumjs/core";
import { User } from "@entities/user.entity";

export interface IUserRepository extends BaseRepository<User, string> {
    findByEmail(email: string): Promise<User | null>;
    findAdmins(): Promise<User[]>;
}

@Bean("IUserRepository")
export class UserRepository extends BaseRepository<User, string> implements IUserRepository {
    protected readonly entityCtor = User;

    async findByEmail(email: string): Promise<User | null> {
        return this.query().where("email", email).first();
    }

    async findAdmins(): Promise<User[]> {
        return this.query().where("role", "ADMIN").all();
    }
}
```

## Repository Methods

```typescript
// BaseRepository provides:
const user = await this.userRepo.findById(id);
const users = await this.userRepo.findAll();
const saved = await this.userRepo.save(user);
const updated = await this.userRepo.update(id, partialEntity);
await this.userRepo.deleteById(id);
const count = await this.userRepo.count();

// Query builder
const admins = await this.userRepo.query()
    .where("role", "ADMIN")
    .orderBy("name", "ASC")
    .all();

// Pagination
const page = await this.userRepo.query()
    .paginate({ page: 1, size: 20, sorts: [] });

// Raw query
const result = await this.userRepo.raw("SELECT * FROM users WHERE email = $1", ["john@example.com"]);
```

## @Transactional

```typescript
import { Transactional } from "@solumjs/database";

@Bean("IOrderService")
export class OrderService {

    @Transactional()
    async createOrder(dto: CreateOrderDto): Promise<Order> {
        const order = await this.orderRepo.save(new Order(dto));
        await this.inventoryRepo.decrement(dto.productId, dto.quantity);
        return order; // both operations in same transaction
    }
}
```

## Optimistic Locking

```typescript
import { OptimisticLockException } from "@solumjs/database";
import { VersionColumn } from "@solumjs/orm";

@Entity("users")
export class User {
    @VersionColumn()
    public version!: number;
}

// Throws OptimisticLockException if version mismatch
```

## Driver Factory

```typescript
import { createDatabaseDriver } from "@solumjs/database";

// Auto-configured from environment variables:
// DB_CLIENT=postgres|mysql|sqlite|mssql|oracle
// DB_HOST=localhost
// DB_PORT=5432
// DB_NAME=mydb
// DB_USER=postgres
// DB_PASSWORD=secret

const driver = await createDatabaseDriver();
```

## Individual Drivers

```typescript
import { PostgresDriver } from "@solumjs/database";
import { SqliteDriver } from "@solumjs/database";
import { MysqlDriver } from "@solumjs/database";
import { MssqlDriver } from "@solumjs/database";
import { OracleDriver } from "@solumjs/database";
```

## Migrations

```typescript
import { MigrationRunner, createDatabaseDriver } from "@solumjs/database";

const driver = await createDatabaseDriver();
const runner = new MigrationRunner(driver, path.join(__dirname, "migrations"));

await runner.run();        // Run pending migrations
await runner.rollback(1);  // Rollback last migration
await runner.status();     // Show migration status
```

```bash
npm run migrate                           # Run all pending
npm run migrate:down 1                    # Rollback 1 step
npm run migrate:status                    # Show status
npm run migrate:generate CreateUsersTable # Generate new migration
```

## License

MIT
