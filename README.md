# SolumJS

[![npm version](https://img.shields.io/npm/v/@solumjs/core.svg)](https://www.npmjs.com/package/@solumjs/core)
[![npm downloads](https://img.shields.io/npm/dm/@solumjs/core.svg)](https://www.npmjs.com/package/@solumjs/core)
[![license](https://img.shields.io/npm/l/@solumjs/core.svg)](https://github.com/hidesec/backend-example/blob/main/LICENSE)
[![node](https://img.shields.io/node/v/@solumjs/core.svg)](https://nodejs.org)

**A modular, decorator-driven backend framework for Node.js and TypeScript**

SolumJS is a full-stack backend framework that brings the simplicity and convention of Spring Boot to the Node.js ecosystem. Built entirely from scratch with **zero runtime dependencies in core**, it provides a complete toolchain for building production-ready APIs, from dependency injection to database management.

---

## Table of Contents

- [Features](#features)
- [Quick Install](#quick-install)
- [Architecture](#architecture)
- [Getting Started](#getting-started)
- [Packages](#packages)
- [Core Concepts](#core-concepts)
  - [Dependency Injection](#dependency-injection)
  - [Decorators](#decorators)
  - [HTTP Layer](#http-layer)
  - [ORM & Database](#orm--database)
  - [Authentication & Authorization](#authentication--authorization)
  - [Caching](#caching)
  - [Events](#events)
  - [Scheduling](#scheduling)
  - [Validation](#validation)
  - [AOP (Aspect-Oriented Programming)](#aop-aspect-oriented-programming)
  - [Error Handling](#error-handling)
  - [Testing](#testing)
  - [WebSocket](#websocket)
  - [Email](#email)
  - [Configuration](#configuration)
  - [CLI](#cli)
- [Example Application](#example-application)
- [Contributing](#contributing)
- [License](#license)

---

## Features

### Core Framework
- **Dependency Injection** — Full IoC container with singleton, prototype, request, and session scopes
- **Decorator-Driven** — 90+ decorators for routing, validation, caching, auth, and more
- **Zero Core Dependencies** — Framework core uses only Node.js built-ins
- **TypeScript Native** — First-class TypeScript support with full type inference

### HTTP Layer
- **REST API** — Declarative route definitions with `@Get`, `@Post`, `@Put`, `@Patch`, `@Delete`
- **Parameter Binding** — `@Body`, `@Param`, `@Query`, `@Header`, `@CookieValue`, `@CurrentUser`
- **Guards & Interceptors** — `@UseGuards`, `@UseInterceptors` for cross-cutting concerns
- **Declarative HTTP Clients** — `@HttpClient`, `@HttpGet`, `@HttpPost` for external API calls
- **Pagination** — Built-in `PageRequest` and `Page<T>` model with cursor support
- **OpenAPI/Swagger** — Auto-generated API documentation

### Data Layer
- **ORM** — Entity decorators (`@Entity`, `@Column`, `@ManyToOne`, `@OneToMany`, etc.)
- **Query Builder** — Fluent SQL builder with joins, pagination, and multi-dialect support
- **Multi-Database** — PostgreSQL, MySQL, SQLite, MSSQL, Oracle, MongoDB
- **Migrations** — File-based migration runner with status tracking
- **Schema Sync** — Drift detection and automatic schema updates
- **Repositories** — Generic `BaseRepository<T, ID>` with CRUD, derived queries, and transactions
- **Optimistic Locking** — Version-based conflict detection

### Security
- **JWT Authentication** — `JwtAuthGuard` with access/refresh token flow
- **Role-Based Access** — `RolesGuard` and `@Roles` decorator
- **Method-Level Security** — `@PreAuthorize` with SpEL-like expressions
- **OAuth2** — OAuth2 client and guard integration
- **Password Hashing** — Built-in scrypt-based password hashing
- **Security Headers** — Configurable security middleware (CSP, HSTS, etc.)
- **Rate Limiting** — Per-IP and per-route rate limiting
- **CORS** — Full CORS configuration

### Resilience
- **Circuit Breaker** — `@CircuitBreakerDec` with configurable thresholds
- **Retry** — `@Retry` with exponential backoff
- **Timeouts** — Per-route timeout configuration
- **Fallback** — `@Fallback` for graceful degradation
- **Bulkhead** — Concurrency limiting

### Cross-Cutting Concerns
- **Caching** — `@Cacheable`, `@CacheEvict`, `@CachePut` with InMemory and Redis stores
- **Events** — `EventBus`, `@EventListener`, `@TransactionalEventListener`
- **Scheduling** — `@Scheduled` with cron expressions and interval notation
- **Validation** — 20+ validation decorators with whitelist/blacklist modes
- **AOP** — `@Aspect`, `@Around`, `@Before`, `@After`, `@AfterReturning`, `@AfterThrowing`
- **Logging** — Configurable logger with structured output
- **Metrics** — Prometheus-compatible metrics registry
- **Tracing** — Built-in request tracing with trace IDs
- **I18n** — Internationalization with resource bundles

### Operations
- **Actuator** — Health checks, metrics endpoints, config introspection
- **Batch Processing** — `Job` and `Step` abstractions for batch workflows
- **Service Discovery** — `DiscoveryClient` for microservices
- **Configuration Server** — `ConfigServer` and `ConfigClient` for distributed config

### Development
- **CLI** — `solum new` and `solum generate` commands
- **Testing** — `createTestApplication()`, `@MockBean`, `MockLogger`, MockMvc-like assertions
- **Hot Reload** — `ts-node-dev` integration for development

---

## Quick Install

```bash
# Install everything at once
npm install solumjs

# Then create a project
npx solum new my-app
cd my-app
npm run dev
```

**Or install individually:**
```bash
npm install @solumjs/core @solumjs/http @solumjs/config @solumjs/orm @solumjs/database
npm install @solumjs/auth @solumjs/cache @solumjs/events @solumjs/schedule
npm install @solumjs/validation @solumjs/middlewares @solumjs/aop @solumjs/testing
npm install @solumjs/websocket @solumjs/email
```

**Available packages:**

| Package | Install | Description |
|---------|---------|-------------|
| `solumjs` | `npm i solumjs` | Install all packages + CLI |
| `@solumjs/core` | `npm i @solumjs/core` | DI container, decorators, HTTP exceptions |
| `@solumjs/http` | `npm i @solumjs/http` | Router, REST decorators, guards, interceptors |
| `@solumjs/aop` | `npm i @solumjs/aop` | Aspect-Oriented Programming |
| `@solumjs/orm` | `npm i @solumjs/orm` | Entity/column decorators, query builder |
| `@solumjs/database` | `npm i @solumjs/database` | Repository, migrations, transactions |
| `@solumjs/cache` | `npm i @solumjs/cache` | `@Cacheable`, `@CacheEvict`, `@CachePut` |
| `@solumjs/auth` | `npm i @solumjs/auth` | JWT, passwords, guards, OAuth2 |
| `@solumjs/events` | `npm i @solumjs/events` | `EventBus`, `@EventListener` |
| `@solumjs/schedule` | `npm i @solumjs/schedule` | `@Scheduled` with cron support |
| `@solumjs/config` | `npm i @solumjs/config` | Bootstrap, `.env` loading, `@Value` |
| `@solumjs/validation` | `npm i @solumjs/validation` | 20+ validation decorators |
| `@solumjs/middlewares` | `npm i @solumjs/middlewares` | Security, CORS, rate limiting |
| `@solumjs/testing` | `npm i @solumjs/testing` | `createTestApplication()`, `@MockBean` |
| `@solumjs/websocket` | `npm i @solumjs/websocket` | WebSocket handlers, STOMP protocol |
| `@solumjs/email` | `npm i @solumjs/email` | SMTP email, templates |
| `@solumjs/cli` | `npm i -g @solumjs/cli` | `solum new`, `solum generate` |

---

## Architecture

```
+-------------------------------------------------------------------+
|                        Application Layer                           |
|  +--------------+  +--------------+  +-------------+  +----------+ |
|  |  Controllers  |  |   Services   |  |  Listeners  |  | Schedule | |
|  +------+-------+  +------+-------+  +------+------+  +----+-----+ |
|         |                |                 |               |       |
+---------+----------------+-----------------+---------------+-------+
|                        Cross-Cutting Layer                          |
|  +----+-------+--------+----------+--------+---------+-----------+ |
|  |  Guards  | Interceptors |    AOP     | Validation |   Caching   | |
|  +----------+--------------+-----------+------------+-------------+ |
|                          |                                           |
+--------------------------+-------------------------------------------+
|                        Infrastructure Layer                          |
|  +------------+    +-----------+    +----------+    +-------------+  |
|  |    ORM     |    |   HTTP    |    |  Events  |    |   Cache     |  |
|  | QueryBldr  |    |  Adapter  |    |  (Bus)   |    | (InMemory)  |  |
|  +------+-----+    +-----------+    +----------+    +-------------+  |
|         |                                                              |
+---------+--------------------------------------------------------------+
|                        Database Layer                                  |
|  +------------------------------------------------------------------+ |
|  |  PostgreSQL  |  MySQL  |  SQLite  |  MSSQL  |  Oracle  | MongoDB | |
|  +------------------------------------------------------------------+ |
+------------------------------------------------------------------------+
```

### Layered Architecture

1. **Core** — IoC container, decorator metadata, reflect-metadata polyfill
2. **HTTP** — Router, decorators, guards, interceptors, Node.js adapter
3. **ORM** — Entity management, query builder, schema builder, dialect abstraction
4. **Database** — Repositories, migrations, driver factory, transaction management
5. **Feature Packages** — Auth, Cache, Events, Schedule, Validation, AOP, Middlewares
6. **Config** — Application bootstrap, component scanning, environment loading
7. **Testing** — Mock utilities, test application factory

---

## Getting Started

### Prerequisites

- **Node.js** >= 18.0.0
- **TypeScript** >= 5.0.0
- **npm** >= 9.0.0

### Quick Start (New Project)

```bash
npm install solumjs
npx solum new my-app
cd my-app
npm run dev
```

Your API is now running at `http://localhost:3000`

### Manual Setup

```bash
mkdir my-api && cd my-api
npm init -y
npm install @solumjs/core @solumjs/http @solumjs/config @solumjs/orm @solumjs/database
npm install -D typescript @types/node ts-node-dev
```

**tsconfig.json:**
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "dist",
    "rootDir": "./src",
    "declaration": true,
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true,
    "paths": {
      "@config/*": ["./src/config/*"],
      "@controllers/*": ["./src/controllers/*"],
      "@services/*": ["./src/services/*"],
      "@entities/*": ["./src/entities/*"],
      "@repositories/*": ["./src/repositories/*"],
      "@dto/*": ["./src/dto/*"]
    },
    "types": ["node", "jest"]
  },
  "include": ["src"]
}
```

**src/app.ts:**
```typescript
import "@solumjs/core";
import { createApplication, createEnvConfig, loadEnv } from "@solumjs/config";

loadEnv();

createApplication({
    config: createEnvConfig(process.env),
    scanBaseDir: __dirname,
    scanDirs: ["controllers", "services", "repositories"],
    bodyLimitBytes: 10 * 1024,
});
```

**src/controllers/health.controller.ts:**
```typescript
import { RestController, Get } from "@solumjs/http";

@RestController("")
export class HealthController {
    @Get("/health")
    async health() {
        return { status: "UP", timestamp: new Date().toISOString() };
    }
}
```

**Run:**
```bash
npm run dev
```

---

## Packages

SolumJS is organized as a monorepo with 16 modular packages:

| Package | npm | Install | Description |
|---------|-----|---------|-------------|
| [`core`](#core) | [`@solumjs/core`](https://www.npmjs.com/package/@solumjs/core) | `npm i @solumjs/core` | DI container, decorators, HTTP exceptions, resilience, metrics, tracing, i18n, batch, discovery |
| [`http`](#http) | [`@solumjs/http`](https://www.npmjs.com/package/@solumjs/http) | `npm i @solumjs/http` | Router, REST decorators, guards, interceptors, Node.js adapter, HTTP clients |
| [`aop`](#aop) | [`@solumjs/aop`](https://www.npmjs.com/package/@solumjs/aop) | `npm i @solumjs/aop` | Aspect-Oriented Programming: aspects, pointcuts, advice |
| [`orm`](#orm) | [`@solumjs/orm`](https://www.npmjs.com/package/@solumjs/orm) | `npm i @solumjs/orm` | Entity/column decorators, query builder, schema builder, dialect abstraction |
| [`database`](#database) | [`@solumjs/database`](https://www.npmjs.com/package/@solumjs/database) | `npm i @solumjs/database` | `BaseRepository`, `@Transactional`, migrations, driver factory |
| [`cache`](#cache) | [`@solumjs/cache`](https://www.npmjs.com/package/@solumjs/cache) | `npm i @solumjs/cache` | `@Cacheable`, `@CacheEvict`, `@CachePut`, InMemory/Redis stores |
| [`auth`](#auth) | [`@solumjs/auth`](https://www.npmjs.com/package/@solumjs/auth) | `npm i @solumjs/auth` | JWT, passwords, guards, `@PreAuthorize`, OAuth2 |
| [`events`](#events) | [`@solumjs/events`](https://www.npmjs.com/package/@solumjs/events) | `npm i @solumjs/events` | `EventBus`, `@EventListener`, transactional listeners |
| [`schedule`](#schedule) | [`@solumjs/schedule`](https://www.npmjs.com/package/@solumjs/schedule) | `npm i @solumjs/schedule` | `@Scheduled` with cron/interval support |
| [`config`](#config) | [`@solumjs/config`](https://www.npmjs.com/package/@solumjs/config) | `npm i @solumjs/config` | `createApplication()`, `.env`/YAML loading, `@Value`, OpenAPI, actuator |
| [`validation`](#validation) | [`@solumjs/validation`](https://www.npmjs.com/package/@solumjs/validation) | `npm i @solumjs/validation` | 20+ validation decorators, whitelist/blacklist modes |
| [`middlewares`](#middlewares) | [`@solumjs/middlewares`](https://www.npmjs.com/package/@solumjs/middlewares) | `npm i @solumjs/middlewares` | Security, CORS, rate limiting, error handling, `@ControllerAdvice` |
| [`testing`](#testing) | [`@solumjs/testing`](https://www.npmjs.com/package/@solumjs/testing) | `npm i @solumjs/testing` | `createTestApplication()`, `@MockBean`, `MockLogger` |
| [`websocket`](#websocket) | [`@solumjs/websocket`](https://www.npmjs.com/package/@solumjs/websocket) | `npm i @solumjs/websocket` | WebSocket handlers, STOMP protocol, `@MessageMapping` |
| [`email`](#email) | [`@solumjs/email`](https://www.npmjs.com/package/@solumjs/email) | `npm i @solumjs/email` | SMTP email, `@SmtpEmail`, `@MailSend`, template engine |
| [`cli`](#cli) | [`@solumjs/cli`](https://www.npmjs.com/package/@solumjs/cli) | `npm i -g @solumjs/cli` | `solum new`, `solum generate` scaffolding commands |
| [`backend-example`](#backend-example) | — | — | Reference implementation demonstrating all features |

---

## Core Concepts

### Dependency Injection

SolumJS provides a full-featured IoC container with automatic constructor injection:

```typescript
import { Bean, inject } from "@solumjs/core";

// Register a class as a bean
@Bean("IUserService")
export class UserService {
    constructor(
        @inject("IUserRepository") private readonly userRepo: IUserRepository,
        @inject("ICacheManager") private readonly cache: CacheManager,
    ) {}
}

// Or register a value/factory
@Bean("APP_VERSION")
export const APP_VERSION = "1.0.0";

// Decorator-based injection
@Bean("IEmailService")
export class EmailService {
    @inject("SMTP_HOST")
    private host!: string;
}
```

#### Scopes

```typescript
import { Bean, Scope } from "@solumjs/core";

// Singleton (default)
@Bean("IUserService", { scope: Scope.SINGLETON })
export class UserService {}

// New instance per injection
@Bean("ILogger", { scope: Scope.PROTOTYPE })
export class Logger {}

// Per-request lifetime (via AsyncLocalStorage)
@Bean("IRequestContext", { scope: Scope.REQUEST })
export class RequestContext {}
```

#### Lifecycle Hooks

```typescript
import { Bean, PostConstruct, PreDestroy } from "@solumjs/core";

@Bean("IDatabasePool")
export class DatabasePool {
    @PostConstruct
    async init() {
        // Called after all dependencies are injected
        await this.connect();
    }

    @PreDestroy
    async cleanup() {
        // Called when the container is shutting down
        await this.disconnect();
    }
}
```

#### Conditional Registration

```typescript
import { Bean, ConditionalOnProperty } from "@solumjs/core";

@Bean("IRedisCache")
@ConditionalOnProperty("REDIS_URL")
export class RedisCache {
    // Only registered if REDIS_URL is set
}
```

---

### Decorators

SolumJS uses decorators extensively. All decorators are composable:

```typescript
import { Bean, PostConstruct } from "@solumjs/core";
import { RestController, Get, Post, Body, Param, UseGuards, UseInterceptors, ResponseStatus } from "@solumjs/http";
import { JwtAuthGuard, RolesGuard, Roles } from "@solumjs/auth";
import { Cacheable } from "@solumjs/cache";
import { Validated } from "@solumjs/validation";

@RestController("/users")
@UseGuards(JwtAuthGuard, RolesGuard)
export class UserController {

    @Get("/:id")
    @Cacheable({ key: "user:{id}", ttl: 300 })
    @Roles("ADMIN")
    async getUser(@Param("id") id: string) {
        return this.userService.findById(id);
    }

    @Post("/")
    @ResponseStatus(201)
    @Validated(CreateUserDto)
    async createUser(@Body() dto: CreateUserDto) {
        return this.userService.createUser(dto);
    }
}
```

---

### HTTP Layer

#### Route Definitions

```typescript
import { RestController, Get, Post, Put, Patch, Delete } from "@solumjs/http";

@RestController("/api/products")
export class ProductController {

    @Get("/")
    async listProducts() { /* ... */ }

    @Get("/:id")
    async getProduct(@Param("id") id: string) { /* ... */ }

    @Post("/")
    async createProduct(@Body() dto: CreateProductDto) { /* ... */ }

    @Put("/:id")
    async updateProduct(@Param("id") id: string, @Body() dto: UpdateProductDto) { /* ... */ }

    @Patch("/:id")
    async patchProduct(@Param("id") id: string, @Body() dto: Partial<UpdateProductDto>) { /* ... */ }

    @Delete("/:id")
    async deleteProduct(@Param("id") id: string) { /* ... */ }
}
```

#### Parameter Decorators

```typescript
@Get("/search")
async search(
    @Query("q") query: string,           // ?q=hello
    @Query("page") page: number,          // ?page=1
    @Header("Authorization") auth: string, // Authorization header
    @CookieValue("session") sid: string,   // session cookie
    @CurrentUser() user: User,            // authenticated user (set by guard)
    @Req() req: SolumjsRequest,           // raw request
    @Res() res: SolumjsResponse,          // raw response
) { /* ... */ }
```

#### Guards

```typescript
import { Guard, ExecutionContext } from "@solumjs/http";
import { inject } from "@solumjs/core";

@Bean("IApiKeyGuard")
export class ApiKeyGuard implements Guard {
    constructor(@inject("IConfigService") private config: ConfigService) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest();
        const apiKey = request.headers["x-api-key"];
        return apiKey === this.config.get("API_KEY");
    }
}

// Usage
@UseGuards(ApiKeyGuard)
@RestController("/api")
export class ApiController { /* ... */ }
```

#### Interceptors

```typescript
import { Interceptor, ExecutionContext, CallHandler } from "@solumjs/http";
import { Observable } from "rxjs"; // conceptually — SolumJS uses async iterators

@Bean("LoggingInterceptor")
export class LoggingInterceptor implements Interceptor {
    async intercept(context: ExecutionContext, next: CallHandler): Promise<any> {
        const start = Date.now();
        const result = await next.handle();
        const duration = Date.now() - start;
        console.log(`Request took ${duration}ms`);
        return result;
    }
}
```

#### Pagination

```typescript
import { PageRequest, Page } from "@solumjs/http";

@RestController("/users")
export class UserController {

    @Get("/")
    async listUsers(@Query() pageRequest: PageRequest): Promise<Page<UserResponseDto>> {
        // pageRequest contains: page, size, sort, direction
        const users = await this.userService.findAll(pageRequest);
        return users; // { data: [...], page, size, total, totalPages }
    }
}
```

#### Declarative HTTP Clients

```typescript
import { HttpClient, HttpGet, HttpPost, HttpPut, HttpDelete, Timeout, Retryable } from "@solumjs/http";

@HttpClient("jsonplaceholder")
@BaseUrl("https://jsonplaceholder.typicode.com")
@Timeout(5000)
@Retryable({ retries: 3 })
export interface TodoClient {

    @HttpGet("/todos/:id")
    getTodo(@Param("id") id: number): Promise<Todo>;

    @HttpPost("/todos")
    createTodo(@Body() todo: CreateTodoDto): Promise<Todo>;

    @HttpPut("/todos/:id")
    updateTodo(@Param("id") id: number, @Body() todo: UpdateTodoDto): Promise<Todo>;

    @HttpDelete("/todos/:id")
    deleteTodo(@Param("id") id: number): Promise<void>;
}
```

---

### ORM & Database

#### Entity Definition

```typescript
import { Entity, Column, ColumnType, PrimaryGeneratedColumn, CreatedAtColumn, UpdatedAtColumn, ManyToOne, OneToMany, ManyToMany, Index } from "@solumjs/orm";

@Entity("users")
@Index("idx_users_email", ["email"], true) // unique index
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

    @CreatedAtColumn()
    public readonly createdAt!: Date;

    @UpdatedAtColumn()
    public readonly updatedAt!: Date;

    @OneToMany(() => Post, (post) => post.author)
    public posts?: Post[];

    @ManyToMany(() => Tag)
    public tags?: Tag[];

    constructor(id: string, name: string, email: string) {
        this.id = id;
        this.name = name;
        this.email = email;
    }
}

@Entity("posts")
export class Post {

    @PrimaryGeneratedColumn(ColumnType.UUID)
    public readonly id!: string;

    @Column({ type: ColumnType.VARCHAR, length: 255 })
    public title!: string;

    @Column({ type: ColumnType.TEXT })
    public content!: string;

    @ManyToOne(() => User, (user) => user.posts)
    public author?: User;
}

@Entity("tags")
export class Tag {

    @PrimaryGeneratedColumn(ColumnType.UUID)
    public readonly id!: string;

    @Column({ type: ColumnType.VARCHAR, length: 50 })
    public name!: string;
}
```

#### Query Builder

```typescript
import { QueryBuilder } from "@solumjs/orm";

// SELECT with conditions
const users = await this.queryBuilder
    .select()
    .from("users")
    .where("role", "ADMIN")
    .andWhere("createdAt", ">", new Date("2024-01-01"))
    .orderBy("name", "ASC")
    .limit(10)
    .offset(0)
    .execute();

// JOIN
const usersWithPosts = await this.queryBuilder
    .select()
    .from("users")
    .innerJoin("posts", "users.id", "posts.authorId")
    .where("users.role", "ADMIN")
    .execute();

// INSERT
await this.queryBuilder
    .insert("users")
    .values({ name: "John", email: "john@example.com" })
    .execute();

// UPDATE
await this.queryBuilder
    .update("users")
    .set({ name: "Jane" })
    .where("id", userId)
    .execute();

// DELETE
await this.queryBuilder
    .delete()
    .from("users")
    .where("id", userId)
    .execute();
```

#### Repository Pattern

```typescript
import { BaseRepository } from "@solumjs/database";
import { Bean, inject } from "@solumjs/core";
import { User } from "@entities/user.entity";

export interface IUserRepository extends IBaseRepository<User, string> {
    findByEmail(email: string): Promise<User | null>;
    findAdmins(): Promise<User[]>;
}

@Bean("IUserRepository")
export class UserRepository extends BaseRepository<User, string> implements IUserRepository {
    protected readonly entityCtor = User;

    async findByEmail(email: string): Promise<User | null> {
        return this.query()
            .where("email", email)
            .first();
    }

    async findAdmins(): Promise<User[]> {
        return this.query()
            .where("role", "ADMIN")
            .all();
    }
}

// Usage in service
@Bean("IUserService")
export class UserService {
    constructor(@inject("IUserRepository") private userRepo: IUserRepository) {}

    async createUser(dto: CreateUserDto): Promise<User> {
        const user = new User(crypto.randomUUID(), dto.name, dto.email);
        user.passwordHash = hashPassword(dto.password);
        return this.userRepo.save(user);
    }

    async findById(id: string): Promise<User> {
        const user = await this.userRepo.findById(id);
        if (!user) throw new NotFoundException(`User ${id} not found`);
        return user;
    }
}
```

#### Transactions

```typescript
import { Transactional } from "@solumjs/database";

@Bean("IOrderService")
export class OrderService {

    @Transactional()
    async createOrder(dto: CreateOrderDto): Promise<Order> {
        // Both operations run in the same transaction
        const order = await this.orderRepo.save(new Order(dto));
        await this.inventoryRepo.decrement(dto.productId, dto.quantity);
        return order;
    }
}
```

#### Database Configuration

```typescript
import { createDatabaseDriver } from "@solumjs/database";

// Auto-configured from environment variables:
// DB_CLIENT=postgres, DB_HOST=localhost, DB_PORT=5432, DB_NAME=mydb, DB_USER=postgres, DB_PASSWORD=secret

const driver = await createDatabaseDriver();
```

**Supported drivers:**
- `postgres` (PostgreSQL)
- `mysql` (MySQL)
- `sqlite` (SQLite)
- `mssql` (MS SQL Server)
- `oracle` (Oracle)

#### Migrations

```typescript
// src/database/migrate.ts
import { MigrationRunner, createDatabaseDriver } from "@solumjs/database";

const driver = await createDatabaseDriver();
const runner = new MigrationRunner(driver, path.join(__dirname, "migrations"));

// Run pending migrations
await runner.run();

// Rollback last migration
await runner.rollback(1);

// Check status
await runner.status();
```

```bash
npm run migrate           # Run all pending
npm run migrate:down 1    # Rollback 1 step
npm run migrate:status    # Show migration status
npm run migrate:generate CreateUsersTable  # Generate new migration file
```

#### Schema Sync

```typescript
import { SchemaSync } from "@solumjs/orm";

const sync = new SchemaSync(driver, [User, Product, Order]);

// Validate schema (drift detection)
const result = await sync.validate();
if (!result.ok) {
    for (const diff of result.diffs) console.error(diff);
}

// Auto-update schema
await sync.update();
```

---

### Authentication & Authorization

#### JWT Authentication

```typescript
import { JwtAuthGuard, RolesGuard, Roles } from "@solumjs/auth";
import { RestController, Get, Post, Body, UseGuards, CurrentUser } from "@solumjs/http";

@RestController("/users")
@UseGuards(JwtAuthGuard, RolesGuard)
export class UserController {

    @Get("/")
    @Roles("ADMIN")
    async listUsers() {
        return this.userService.findAll();
    }

    @Get("/me")
    async getProfile(@CurrentUser() user: JwtPayload) {
        return this.userService.findById(user.sub);
    }
}
```

#### JWT Service

```typescript
import { JwtService, TokenClaims } from "@solumjs/auth";

const jwtService = new JwtService({ secret: "your-secret", expiresIn: 3600 });

const claims: TokenClaims = { sub: user.id, email: user.email, role: user.role };

// Generate tokens
const accessToken = jwtService.signAccessToken(claims);
const refreshToken = jwtService.signRefreshToken(claims);

// Verify token
const payload = jwtService.verify(accessToken);
```

#### PreAuthorize

```typescript
import { PreAuthorize } from "@solumjs/auth";
import { RestController, Get, Param } from "@solumjs/http";

@RestController("/documents")
export class DocumentController {

    @Get("/:id")
    @PreAuthorize("hasRole('ADMIN') or #id == authentication.sub")
    async getDocument(@Param("id") id: string) {
        return this.documentService.findById(id);
    }
}
```

#### Password Hashing

```typescript
import { hashPassword, verifyPassword } from "@solumjs/auth";

// Hash a password (scrypt with random salt)
const hash = hashPassword("my-password");

// Verify a password
const isValid = verifyPassword("my-password", hash);
```

#### OAuth2

```typescript
import { OAuth2Client, OAuth2Guard } from "@solumjs/auth";

@Bean("IOAuth2Client")
export const googleOAuth2Client = new OAuth2Client({
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    redirectUri: "http://localhost:3000/auth/google/callback",
    authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenEndpoint: "https://oauth2.googleapis.com/token",
    scopes: ["openid", "email", "profile"],
});
```

---

### Caching

```typescript
import { Cacheable, CacheEvict, CachePut, CacheManager } from "@solumjs/cache";
import { Bean, inject } from "@solumjs/core";

@Bean("IProductService")
export class ProductService {

    @Cacheable({ key: "product:{id}", ttl: 300 })
    async findById(id: string): Promise<Product> {
        // Only executed if not in cache
        return this.productRepo.findById(id);
    }

    @CachePut({ key: "product:{id}", ttl: 300 })
    async update(id: string, dto: UpdateProductDto): Promise<Product> {
        // Always executes and updates cache
        return this.productRepo.update(id, dto);
    }

    @CacheEvict({ key: "product:{id}" })
    async delete(id: string): Promise<void> {
        // Removes from cache
        await this.productRepo.delete(id);
    }

    @CacheEvict({ key: "products:list", allEntries: true })
    async clearCache(): Promise<void> {
        // Removes all matching entries
    }
}
```

**Cache Stores:**

```typescript
import { InMemoryCacheStore } from "@solumjs/cache";
import { RedisCacheStore } from "@solumjs/cache";

// In-memory (default)
const memoryCache = new InMemoryCacheStore({ maxSize: 1000 });

// Redis
const redisCache = new RedisCacheStore({
    host: "localhost",
    port: 6379,
    prefix: "myapp:",
});
```

---

### Events

```typescript
import { EventBus, EventListener, OnEvent, TransactionalEventListener, Async } from "@solumjs/events";
import { Bean, inject } from "@solumjs/core";

// Publishing events
@Bean("IUserService")
export class UserService {
    constructor(@inject("IEventBus") private eventBus: EventBus) {}

    async createUser(dto: CreateUserDto): Promise<User> {
        const user = await this.userRepo.save(new User(dto));
        this.eventBus.publish("USER_CREATED", { userId: user.id, email: user.email });
        return user;
    }
}

// Listening to events
export class UserCreatedListener {

    @OnEvent("USER_CREATED")
    async handleUserCreated(payload: { userId: string; email: string }) {
        console.log(`User created: ${payload.email}`);
    }
}

// Transactional listener (runs after parent transaction commits)
export class UserAuditListener {

    @TransactionalEventListener("USER_CREATED")
    async handleAfterCommit(payload: { userId: string }) {
        // Only runs if the transaction that published the event committed
        await this.auditRepo.log("USER_CREATED", payload);
    }
}

// Async listener
export class UserWelcomeListener {

    @OnEvent("USER_CREATED")
    @Async()
    async sendWelcomeEmail(payload: { userId: string; email: string }) {
        // Runs asynchronously, does not block the publisher
        await this.emailService.sendWelcome(payload.email);
    }
}
```

---

### Scheduling

```typescript
import { Scheduled } from "@solumjs/schedule";
import { Bean } from "@solumjs/core";

@Bean("ICacheMaintenanceTask")
export class CacheMaintenanceTask {

    @Scheduled("0 * * * *") // Every hour
    async cleanExpiredCache() {
        console.log("Cleaning expired cache entries...");
    }

    @Scheduled("*/30 * * * *") // Every 30 minutes
    async refreshMetrics() {
        console.log("Refreshing metrics...");
    }

    @Scheduled("0 2 * * *", { timezone: "America/New_York" }) // 2 AM EST
    async dailyCleanup() {
        console.log("Running daily cleanup...");
    }
}
```

**Cron Syntax:**
```
.------------------- minute (0-59)
|  .---------------- hour (0-23)
|  |  .------------- day of month (1-31)
|  |  |  .---------- month (1-12)
|  |  |  |  .------- day of week (0-6, Sunday=0)
|  |  |  |  |
*  *  *  *  *
```

---

### Validation

```typescript
import {
    IsString, IsEmail, IsOptional, MinLength, MaxLength,
    IsIn, IsUUID, IsNumber, Min, Max, IsArray, ValidateNested,
    IsPositive, IsNegative, IsUrl, IsDateString, Pattern
} from "@solumjs/validation";
import { Validated } from "@solumjs/validation";

export class CreateUserDto {
    @IsString()
    @MinLength(2)
    @MaxLength(100)
    name!: string;

    @IsEmail()
    email!: string;

    @IsOptional()
    @IsString()
    @MinLength(8)
    @Pattern(/^(?=.*[A-Za-z])(?=.*\d)/)
    password?: string;

    @IsOptional()
    @IsIn(["USER", "ADMIN", "MODERATOR"])
    role?: string;

    @IsOptional()
    @IsUrl()
    avatarUrl?: string;
}

export class CreateOrderDto {
    @IsUUID()
    productId!: string;

    @IsNumber()
    @IsPositive()
    quantity!: number;

    @IsOptional()
    @IsString()
    notes?: string;

    @IsArray()
    @ValidateNested({ each: true })
    tags?: TagDto[];
}

// Usage
@RestController("/users")
export class UserController {

    @Post("/")
    @Validated(CreateUserDto)
    async createUser(@Body() dto: CreateUserDto) {
        return this.userService.createUser(dto);
    }
}
```

**Available Validators:**
- Type: `@IsString`, `@IsNumber`, `@IsBoolean`, `@IsArray`, `@IsInt`
- Format: `@IsEmail`, `@IsUrl`, `@IsJWT`, `@IsUUID`, `@IsDateString`
- Length: `@MinLength`, `@MaxLength`, `@Size`
- Range: `@Min`, `@Max`, `@IsPositive`, `@IsNegative`
- Constraint: `@IsIn`, `@Pattern`, `@NotEmpty`, `@NotBlank`, `@NotNull`
- Optional: `@IsOptional`
- Nested: `@ValidateNested`

---

### AOP (Aspect-Oriented Programming)

```typescript
import { Aspect, Around, Before, After, AfterReturning, AfterThrowing } from "@solumjs/aop";
import { LogExecution, Auditable } from "@solumjs/aop";
import { Bean } from "@solumjs/core";

// Custom aspect
@Aspect("execution(* com.myapp.service.*.*(..))")
@Bean("PerformanceAspect")
export class PerformanceAspect {

    @Around("execution(* com.myapp.service.*.*(..))")
    async measurePerformance(joinPoint: any) {
        const start = Date.now();
        const result = await joinPoint.proceed();
        const duration = Date.now() - start;
        console.log(`${joinPoint.target.constructor.name}.${joinPoint.methodName} took ${duration}ms`);
        return result;
    }
}

// Built-in logging
@Bean("IUserService")
export class UserService {

    @LogExecution({ level: "info", includeArgs: true, includeResult: false })
    async createUser(dto: CreateUserDto): Promise<User> {
        // Automatically logs method entry/exit
        return this.userRepo.save(new User(dto));
    }
}

// Built-in audit logging
@Bean("IDocumentService")
export class DocumentService {

    @Auditable({ action: "UPDATE", resource: "Document" })
    async updateDocument(id: string, dto: UpdateDocumentDto): Promise<Document> {
        // Automatically logs audit trail
        return this.documentRepo.update(id, dto);
    }
}
```

**Available Advice:**
- `@Around` — Wraps the method execution
- `@Before` — Runs before method execution
- `@After` — Runs after method execution (always)
- `@AfterReturning` — Runs after successful execution
- `@AfterThrowing` — Runs after exception
- `@LogExecution` — Built-in logging aspect
- `@Auditable` — Built-in audit trail aspect

---

### Error Handling

#### HTTP Exceptions

```typescript
import {
    BadRequestException,
    UnauthorizedException,
    ForbiddenException,
    NotFoundException,
    ConflictException,
    InternalServerErrorException,
    HttpException
} from "@solumjs/core";

throw new NotFoundException(`User ${id} not found`);
throw new ConflictException(`Email ${email} is already registered`);
throw new BadRequestException("Invalid input", { details: errors });
```

#### ControllerAdvice (Global Error Handling)

```typescript
import { ControllerAdvice, ExceptionHandler } from "@solumjs/middlewares";
import { SolumjsRequest } from "@solumjs/http";
import { NotFoundException, BadRequestException } from "@solumjs/core";

@ControllerAdvice
export class GlobalExceptionAdvice {

    @ExceptionHandler(NotFoundException)
    handleNotFound(err: NotFoundException, req: SolumjsRequest) {
        req.log.warn({ path: req.path }, err.message);
        return { status: "error", code: "NOT_FOUND", message: err.message };
    }

    @ExceptionHandler(BadRequestException)
    handleBadRequest(err: BadRequestException, req: SolumjsRequest) {
        req.log.warn({ path: req.path }, err.message);
        return { status: "error", code: "BAD_REQUEST", message: err.message };
    }

    @ExceptionHandler(Error)
    handleGeneric(err: Error, req: SolumjsRequest) {
        req.log.error({ path: req.path, err }, "Unhandled error");
        return { status: "error", code: "INTERNAL_ERROR", message: "Internal server error" };
    }
}
```

#### Security Middleware

```typescript
import {
    SecurityHeadersMiddleware,
    CorsMiddleware,
    RateLimitMiddleware,
    RequestLoggerMiddleware,
    ErrorHandlerMiddleware
} from "@solumjs/middlewares";

// Applied via createApplication() configuration or manually
```

---

### Testing

#### Setup

```typescript
import { createTestApplication } from "@solumjs/testing";
import { MockBean, MockLogger } from "@solumjs/testing";
import { UserController } from "./user.controller";
import { UserService } from "./user.service";

describe("UserController", () => {
    let app: any;

    beforeAll(async () => {
        app = await createTestApplication({
            controllers: [UserController],
            providers: [
                MockBean("IUserService", {
                    findAll: jest.fn().mockResolvedValue([]),
                    findById: jest.fn().mockResolvedValue(null),
                    createUser: jest.fn().mockResolvedValue({ id: "1", name: "Test" }),
                }),
            ],
            logger: MockLogger(),
        });
    });

    afterAll(async () => {
        await app?.close();
    });

    it("should return user by ID", async () => {
        const response = await app.get("/users/1").expect(200);
        expect(response.body.id).toBe("1");
    });
});
```

#### Unit Testing Services

```typescript
import { UserService } from "./user.service";
import { MockBean } from "@solumjs/testing";

describe("UserService", () => {
    let service: UserService;
    let mockUserRepo: any;

    beforeEach(() => {
        mockUserRepo = {
            findById: jest.fn(),
            save: jest.fn(),
        };
        service = new UserService(mockUserRepo);
    });

    it("should throw NotFoundException for missing user", async () => {
        mockUserRepo.findById.mockResolvedValue(null);
        await expect(service.findById("nonexistent")).rejects.toThrow("not found");
    });
});
```

---

### WebSocket

```typescript
import { WebSocketHandler, StompHandler, MessageMapping, Connect, Disconnect, Error } from "@solumjs/websocket";
import { Bean } from "@solumjs/core";

// Raw WebSocket handler
@WebSocketHandler("/ws")
export class ChatHandler {

    @Connect
    onConnect(client: any) {
        console.log("Client connected");
    }

    @MessageMapping("/chat")
    onMessage(client: any, message: any) {
        // Broadcast to all clients
        this.broadcast({ type: "chat", data: message });
    }

    @Disconnect
    onDisconnect(client: any) {
        console.log("Client disconnected");
    }
}

// STOMP handler
@StompHandler("/stomp")
export class StompChatHandler {

    @Connect
    onConnect(client: any) {
        client.subscribe("/topic/messages", (msg: any) => {
            client.send("/queue/user-" + client.id, {}, msg.body);
        });
    }

    @MessageMapping("/send")
    onSendMessage(client: any, message: any) {
        // Process STOMP message
    }
}
```

---

### Email

```typescript
import { SmtpEmail, MailSend, MailService, TemplateEngine } from "@solumjs/email";
import { Bean } from "@solumjs/core";

// Configure SMTP
@Bean("ISmtpEmail")
@SmtpEmail({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    auth: { user: "you@gmail.com", pass: "app-password" },
})
export class AppEmailClient {}

// Send emails
@Bean("INotificationService")
export class NotificationService {

    constructor(
        @inject("IMailService") private mailService: MailService,
        @inject("ITemplateEngine") private templateEngine: TemplateEngine,
    ) {}

    @MailSend({ to: "{email}", subject: "Welcome!", template: "welcome" })
    async sendWelcome(user: User) {
        return { name: user.name, email: user.email };
    }
}
```

---

### Configuration

#### Application Bootstrap

```typescript
import { createApplication, createEnvConfig, loadEnv } from "@solumjs/config";

loadEnv();

createApplication({
    logger,
    config: createEnvConfig(process.env),
    scanBaseDir: __dirname,
    scanDirs: ["controllers", "services", "repositories", "tasks", "advice"],
    bodyLimitBytes: 10 * 1024 * 1024, // 10MB
    onListen: (port) => console.log(`Server running on port ${port}`),
});
```

#### Environment Loading

```typescript
import { loadEnv } from "@solumjs/config";

// Loads .env file from project root
loadEnv();

// Then access via process.env
const port = process.env.PORT || 3000;
```

#### YAML Configuration

```yaml
# config/application.yml
server:
  port: 3000
  host: 0.0.0.0

database:
  client: postgres
  host: localhost
  port: 5432
  name: myapp

jwt:
  secret: ${JWT_SECRET}
  expiresIn: 3600
```

#### @Value Decorator

```typescript
import { Value } from "@solumjs/config";
import { Bean } from "@solumjs/core";

@Bean("IAppConfig")
export class AppConfig {
    @Value("server.port")
    port!: number;

    @Value("database.host")
    dbHost!: string;

    @Value("jwt.secret")
    jwtSecret!: string;
}
```

#### Component Scanning

```typescript
createApplication({
    scanBaseDir: __dirname,
    scanDirs: [
        "config/beans",      // Configuration classes
        "repositories",      // Data repositories
        "services",          // Business logic
        "controllers",       // API endpoints
        "advice",            // Exception handlers
        "auth",              // Authentication
        "tasks",             // Scheduled tasks
    ],
});
```

---

### CLI

#### Create New Project

```bash
npx @solumjs/cli new my-app
```

Generates:
- `package.json` with all dependencies
- `tsconfig.json` configured for decorators
- `jest.config.js` with path mapping
- `src/app.ts` bootstrap file
- `src/config/env.ts` environment validation
- `src/config/logger.ts` structured logger
- `src/controllers/health.controller.ts` health endpoint
- `src/entities/user.entity.ts` user entity
- `src/repositories/user.repository.ts` user repository
- `src/services/user.service.ts` user service
- `src/services/user-created.listener.ts` event listener
- `src/dto/` request/response DTOs
- `src/advice/global-exception-filter.ts` error handler
- `src/database/` migration and schema sync scripts

#### Generate Files

```bash
# Controllers
npx @solumjs/cli generate controller Product

# Services
npx @solumjs/cli generate service Product

# Entities
npx @solumjs/cli generate entity Product

# Repositories
npx @solumjs/cli generate repository Product

# DTOs
npx @solumjs/cli generate dto CreateProduct

# Middleware
npx @solumjs/cli generate middleware Auth

# Guards
npx @solumjs/cli generate guard ApiKey

# Event Listeners
npx @solumjs/cli generate listener ProductCreated

# Exception Filters
npx @solumjs/cli generate filter GlobalException
```

---

## Example Application

The [`backend-example`](./packages/backend-example) package demonstrates a complete API with:

### Application Bootstrap

```typescript
// src/app.ts
import "@solumjs/core";
import { createApplication, createEnvConfig, loadEnv } from "@solumjs/config";
import { env } from "@config/env";
import { logger } from "@config/logger";
import { printStartupBanner } from "@config/startup-banner";

loadEnv();

createApplication({
    logger,
    config: createEnvConfig(env),
    scanBaseDir: __dirname,
    scanDirs: ["config/beans", "repositories", "services", "controllers", "advice", "auth", "tasks"],
    bodyLimitBytes: 10 * 1024,
    onListen: printStartupBanner,
});
```

### Controllers

```typescript
// src/controllers/user.controller.ts
import { RestController, Get, Post, Put, Delete, Body, Param, Query, UseGuards, CurrentUser, ResponseStatus } from "@solumjs/http";
import { JwtAuthGuard, RolesGuard, Roles } from "@solumjs/auth";
import { Validated } from "@solumjs/validation";
import { Cacheable, CacheEvict } from "@solumjs/cache";
import { CreateUserDto } from "@dto/create-user.dto";
import { UpdateRoleDto } from "@dto/update-role.dto";

@RestController("/users")
@UseGuards(JwtAuthGuard, RolesGuard)
export class UserController {
    constructor(@inject("IUserService") private readonly userService: IUserService) {}

    @Get("/")
    @Roles("ADMIN")
    async listUsers() {
        return this.userService.findAll();
    }

    @Get("/:id")
    @Cacheable({ key: "user:{id}", ttl: 300 })
    async getUser(@Param("id") id: string) {
        return this.userService.findById(id);
    }

    @Post("/")
    @ResponseStatus(201)
    @Validated(CreateUserDto)
    async createUser(@Body() dto: CreateUserDto) {
        return this.userService.createUser(dto);
    }

    @Put("/:id/role")
    @Roles("ADMIN")
    @CacheEvict({ key: "user:{id}" })
    async updateRole(@Param("id") id: string, @Body() dto: UpdateRoleDto) {
        return this.userService.updateRole(id, dto);
    }

    @Delete("/:id")
    @Roles("ADMIN")
    @CacheEvict({ key: "user:{id}" })
    async deleteUser(@Param("id") id: string) {
        return this.userService.deleteUser(id);
    }
}
```

### Entities

```typescript
// src/entities/user.entity.ts
import { Entity, Column, ColumnType, PrimaryGeneratedColumn, CreatedAtColumn } from "@solumjs/orm";

@Entity("users")
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

    @CreatedAtColumn()
    public readonly createdAt!: Date;

    constructor(id: string, name: string, email: string, role: string = "USER") {
        this.id = id;
        this.name = name;
        this.email = email;
        this.role = role;
    }
}
```

### Services

```typescript
// src/services/user.service.ts
import { Bean, inject, ConflictException, NotFoundException } from "@solumjs/core";
import { hashPassword } from "@solumjs/auth";
import { randomUUID } from "crypto";

@Bean("IUserService")
export class UserService implements IUserService {
    constructor(
        @inject("IUserRepository") private readonly userRepository: IUserRepository,
    ) {}

    async createUser(dto: CreateUserDto): Promise<User> {
        const existing = await this.userRepository.findByEmail(dto.email);
        if (existing) {
            throw new ConflictException(`Email ${dto.email} is already registered`);
        }

        const id = randomUUID();
        const user = new User(id, dto.name, dto.email);
        if (dto.password) {
            user.passwordHash = hashPassword(dto.password);
        }

        return this.userRepository.save(user);
    }

    async findById(id: string): Promise<User> {
        const user = await this.userRepository.findById(id);
        if (!user) {
            throw new NotFoundException(`User with id ${id} not found`);
        }
        return user;
    }
}
```

### Event Listeners

```typescript
// src/services/user-created.listener.ts
import { OnEvent } from "@solumjs/events";
import { logger } from "@config/logger";

export class UserCreatedListener {
    @OnEvent("USER_CREATED")
    handleUserCreated(payload: { userId: string; email: string }) {
        logger.info({ userId: payload.userId }, "User created event received");
    }
}
```

### Environment Validation

```typescript
// src/config/env.ts
import { loadEnv } from "@solumjs/config";

loadEnv();

const SCHEMA = {
    NODE_ENV: { required: true, choices: ["development", "production", "test"] },
    PORT: { default: 3000, isPort: true },
    JWT_SECRET: { required: true },
    DB_CLIENT: { default: "postgres", choices: ["postgres", "mysql", "mssql", "oracle", "sqlite"] },
    DB_HOST: { default: "localhost" },
    DB_PORT: { default: 5432, isPort: true },
    DB_NAME: { required: true },
    DB_USER: { required: true },
    DB_PASSWORD: { required: true },
};

export const env = buildEnv(); // validates all env vars against schema
```

### NPM Scripts

```json
{
    "scripts": {
        "dev": "ts-node-dev --respawn --transpile-only -r tsconfig-paths/register src/app.ts",
        "build": "tsc",
        "start": "node -r ./prod-paths.js dist/app.js",
        "test": "jest",
        "migrate": "ts-node -r tsconfig-paths/register src/database/migrate.ts up",
        "migrate:status": "ts-node -r tsconfig-paths/register src/database/migrate.ts status",
        "migrate:down": "ts-node -r tsconfig-paths/register src/database/migrate.ts down",
        "schema:sync": "ts-node -r tsconfig-paths/register src/database/sync-schema.ts validate",
        "schema:sync:update": "ts-node -r tsconfig-paths/register src/database/sync-schema.ts update"
    }
}
```

---

## Dependency Graph

```
@solumjs/config
    |
    +-- @solumjs/core (container, decorators)
    |
    +-- @solumjs/http (router, decorators)
    |       \-- @solumjs/core
    |
    +-- @solumjs/orm (entity, query builder)
    |       \-- @solumjs/core
    |
    +-- @solumjs/database (repository, transaction)
    |       +-- @solumjs/orm
    |       \-- @solumjs/core
    |
    +-- @solumjs/auth (JWT, guards)
    |       \-- @solumjs/core
    |
    +-- @solumjs/cache (caching decorators)
    |       \-- @solumjs/core
    |
    +-- @solumjs/events (event bus)
    |       \-- @solumjs/core
    |
    +-- @solumjs/schedule (cron jobs)
    |       \-- @solumjs/core
    |
    +-- @solumjs/validation (validators)
    |       \-- @solumjs/core
    |
    +-- @solumjs/middlewares (security, errors)
    |       \-- @solumjs/core
    |
    +-- @solumjs/aop (aspects)
    |       \-- @solumjs/core
    |
    +-- @solumjs/testing (mocks, test app)
    |       \-- @solumjs/core
    |
    +-- @solumjs/websocket (STOMP, WS)
    |       \-- @solumjs/core
    |
    +-- @solumjs/email (SMTP, templates)
    |       \-- @solumjs/core
    |
    \-- @solumjs/cli (scaffolding)
            (standalone)
```

---

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Commit your changes (`git commit -am 'Add my feature'`)
4. Push to the branch (`git push origin feature/my-feature`)
5. Open a Pull Request

---

## License

MIT License - see [LICENSE](./LICENSE) for details.
