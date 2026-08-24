# @solumjs/orm

ORM module with decorators for SolumJS.

## Installation

```bash
npm install @solumjs/orm
```

## Features

- Entity decorators (`@Entity`, `@Column`, `@PrimaryGeneratedColumn`)
- Query builder with fluent API
- Relations (`@OneToMany`, `@ManyToOne`, etc.)
- Migrations
- Multiple database support (PostgreSQL, MySQL, SQLite, MSSQL, Oracle)

## Usage

```typescript
import { Entity, Column, PrimaryGeneratedColumn, BaseRepository } from "@solumjs/orm";

@Entity("users")
class User {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column("varchar", { length: 255 })
    name!: string;
}

class UserRepository extends BaseRepository<User> {
    entityClass = User;
}
```
