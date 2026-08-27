# SolumJS

[![npm version](https://img.shields.io/npm/v/solumjs.svg)](https://www.npmjs.com/package/solumjs)
[![npm downloads](https://img.shields.io/npm/dm/solumjs.svg)](https://www.npmjs.com/package/solumjs)
[![license](https://img.shields.io/npm/l/solumjs.svg)](https://github.com/hidesec/solum/blob/main/LICENSE)
[![node](https://img.shields.io/node/v/solumjs.svg)](https://nodejs.org)

**A modular, decorator-driven backend framework for Node.js and TypeScript**

SolumJS is a full-stack backend framework inspired by Spring Boot, built entirely from scratch with **zero runtime dependencies in core**. It provides a complete toolchain for building production-ready APIs.

---

## Table of Contents

- [Features](#features)
- [Quick Install](#quick-install)
- [Packages](#packages)
- [Getting Started](#getting-started)
- [Migration Guide](docs/migration-guide.md)
- [Core Concepts](#core-concepts)
  - [@solumjs/core](#solumjscore)
  - [@solumjs/http](#solumjshttp)
  - [@solumjs/config](#solumjsconfig)
  - [@solumjs/orm](#solumjsorm)
  - [@solumjs/database](#solumjsdatabase)
  - [@solumjs/auth](#solumjsauth)
  - [@solumjs/cache](#solumjscache)
  - [@solumjs/events](#solumjsevents)
  - [@solumjs/schedule](#solumjsschedule)
  - [@solumjs/validation](#solumjsvalidation)
  - [@solumjs/aop](#solumjsaop)
  - [@solumjs/middlewares](#solumjsmiddlewares)
  - [@solumjs/testing](#solumjstesting)
  - [@solumjs/websocket](#solumjswebsocket)
  - [@solumjs/email](#solumjsemail)
  - [@solumjs/cli](#solumjscli)
- [Example Application](#example-application)
- [License](#license)

---

## Features

- **Dependency Injection** — Full IoC container with singleton, prototype, and request scopes
- **Decorator-Driven** — 90+ decorators for routing, validation, caching, auth, and more
- **Zero Core Dependencies** — Framework core uses only Node.js built-ins
- **TypeScript Native** — First-class TypeScript support with full type inference
- **ES2026 Powered** — Uses modern JS features: `Promise.try`, `Promise.withResolvers`, `Array.fromAsync`, `Object.groupBy`, `Set` methods, `RegExp.escape`, `Error.isError`, `Disposable`/`AsyncDisposable`
- **REST API** — Declarative routes with `@Get`, `@Post`, `@Put`, `@Patch`, `@Delete`
- **ORM** — Entity decorators, query builder, 5 database dialects
- **JWT Auth** — `JwtAuthGuard`, `RolesGuard`, `@PreAuthorize`, OAuth2
- **Caching** — `@Cacheable`, `@CacheEvict`, `@CachePut` with InMemory store
- **Events** — `EventBus`, `@EventListener`, transactional listeners
- **Scheduling** — `@Scheduled` with cron expressions and intervals
- **Validation** — 20+ validation decorators
- **AOP** — `@Aspect`, `@Around`, `@Before`, `@After`, `@LogExecution`
- **WebSocket** — WebSocket handlers and STOMP protocol
- **Email** — SMTP client with template engine

---

## Quick Install

```bash
# Install everything
npm install solumjs

# Create a project
npx solum new my-app
cd my-app
npm run dev
```

**Or install individually:**

```bash
npm install @solumjs/core @solumjs/http @solumjs/config
npm install @solumjs/orm @solumjs/database
npm install @solumjs/auth @solumjs/cache @solumjs/events
npm install @solumjs/schedule @solumjs/validation
npm install @solumjs/middlewares @solumjs/aop
npm install @solumjs/websocket @solumjs/email
```

---

## Packages

| Package | Install | Description |
|---------|---------|-------------|
| `solumjs` | `npm i solumjs` | Meta package — installs all + CLI |
| `@solumjs/core` | `npm i @solumjs/core` | IoC container, decorators, HTTP exceptions, resilience, metrics, tracing, i18n, batch, discovery, logger |
| `@solumjs/http` | `npm i @solumjs/http` | Router, REST decorators, guards, interceptors, pagination, session, HTTP clients, static files |
| `@solumjs/config` | `npm i @solumjs/config` | `createApplication()`, `.env`/YAML loading, `@Value`, OpenAPI/Swagger, actuator endpoints |
| `@solumjs/orm` | `npm i @solumjs/orm` | Entity/column decorators, query builder, relations, schema builder, 5 database dialects |
| `@solumjs/database` | `npm i @solumjs/database` | `BaseRepository`, `@Transactional`, migrations, driver factory |
| `@solumjs/auth` | `npm i @solumjs/auth` | JWT service, `JwtAuthGuard`, `RolesGuard`, `@PreAuthorize`, OAuth2 |
| `@solumjs/cache` | `npm i @solumjs/cache` | `@Cacheable`, `@CacheEvict`, `@CachePut`, InMemory store, `resolveCacheKey` |
| `@solumjs/events` | `npm i @solumjs/events` | `EventBus`, `@EventListener`, `@TransactionalEventListener`, `@Async` |
| `@solumjs/schedule` | `npm i @solumjs/schedule` | `@Scheduled` with cron/interval support, timezone |
| `@solumjs/validation` | `npm i @solumjs/validation` | 20+ validation decorators, whitelist/blacklist modes |
| `@solumjs/middlewares` | `npm i @solumjs/middlewares` | Security headers, CORS, rate limiting, CSRF, error handling, `@ControllerAdvice` |
| `@solumjs/aop` | `npm i @solumjs/aop` | Aspect-Oriented Programming: `@Aspect`, `@Around`, `@Before`, `@After` |
| `@solumjs/testing` | `npm i @solumjs/testing` | `createTestApplication()`, `@MockBean`, `MockLogger` |
| `@solumjs/websocket` | `npm i @solumjs/websocket` | WebSocket handlers, STOMP protocol, `@MessageMapping` |
| `@solumjs/email` | `npm i @solumjs/email` | SMTP client, `@SmtpEmail`, `@MailSend`, template engine, test mode |
| `@solumjs/cli` | `npm i -g @solumjs/cli` | `solum new`, `solum generate`, `solum test`, `solum db:migrate` |

---

## Getting Started

### Prerequisites

- **Node.js** >= 24.0.0 (required for ES2026 features)
- **TypeScript** >= 6.0.0
- **npm** >= 9.0.0

### Quick Start

```bash
npm install solumjs
npx solum new my-app
cd my-app
npm run dev
```

### Manual Setup

```bash
mkdir my-api && cd my-api
npm init -y
npm install @solumjs/core @solumjs/http @solumjs/config @solumjs/orm @solumjs/database
npm install -D typescript @types/node ts-node-dev jest ts-jest @types/jest tsconfig-paths
```

**tsconfig.json:**
```json
{
  "compilerOptions": {
    "target": "ES2025",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2025", "ESNext"],
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

---

## Core Concepts

---

### @solumjs/core

The foundation package providing IoC container, decorators, HTTP exceptions, resilience patterns, metrics, tracing, i18n, batch processing, service discovery, configuration server, event sourcing, and structured logging.

#### IoC Container

```typescript
import { container, inject, Bean } from "@solumjs/core";

// Register and resolve beans
@Bean("IUserService")
export class UserService {
    constructor(@inject("IUserRepo") private userRepo: IUserRepo) {}
}

// Programmatic registration
container.register("IConfig", { port: 3000 });
const config = container.resolve<Record<string, unknown>>("IConfig");

// Resolve all implementations
const allListeners = container.resolveAll("IEventListener");

// Clear container (for testing)
container.clear();
```

#### Bean Decorator & Scopes

```typescript
import { Bean, Scope, PostConstruct, PreDestroy } from "@solumjs/core";

// Singleton (default)
@Bean("IUserService")
export class UserService {}

// Prototype — new instance per injection
@Bean("ILogger", { scope: Scope.PROTOTYPE })
export class Logger {}

// Request scope — per-request lifetime via AsyncLocalStorage
@Bean("IRequestContext", { scope: Scope.REQUEST })
export class RequestContext {}

// Lazy — resolved only on first access
@Bean("IHeavyService", { lazy: true })
export class HeavyService {}

// Primary — preferred when multiple implementations exist
@Bean("ICache")
@Primary()
export class RedisCache implements ICache {}

// Conditional — only register if env var is set
@Bean("IRedisCache")
@ConditionalOnProperty("REDIS_URL")
export class RedisCache {}

// Lifecycle hooks
@Bean("IDatabasePool")
export class DatabasePool {
    @PostConstruct
    async init() {
        await this.connect();
    }

    @PreDestroy
    async cleanup() {
        await this.disconnect();
    }
}
```

#### HTTP Exceptions

```typescript
import {
    BadRequestException,
    UnauthorizedException,
    ForbiddenException,
    NotFoundException,
    ConflictException,
    ServiceUnavailableException,
    PayloadTooLargeException,
    InvalidQueryParameterException,
    HttpException,
} from "@solumjs/core";

throw new NotFoundException(`User ${id} not found`);
throw new ConflictException(`Email ${email} is already registered`);
throw new BadRequestException("Invalid input", { details: errors });
```

#### Structured Logger

```typescript
import { Logger, createLogger, getLogger, setGlobalLogger } from "@solumjs/core";

// Create a logger
const logger = createLogger("MyService", { json: true });
logger.info("Server started", { port: 3000 });
logger.error("Database connection failed", { error: err });

// Get global logger
const log = getLogger("UserService");
log.warn("Cache miss", { key: "user:123" });

// Child loggers
const child = logger.child("auth");
child.info("Token verified");

// Set global logger
setGlobalLogger(createLogger("app", { level: "info", json: true }));
```

#### Resilience (Retry & Circuit Breaker)

```typescript
import { Retry, CircuitBreakerDec, withRetry, withCircuitBreaker } from "@solumjs/core";

// Decorator-based
@Bean("IExternalApiService")
export class ExternalApiService {
    @Retry({ retries: 3, delayMs: 1000 })
    async fetchData() { /* ... */ }

    @CircuitBreakerDec({ failureThreshold: 5, resetTimeoutMs: 30000 })
    async callExternalApi() { /* ... */ }
}

// Programmatic
const result = await withRetry(() => fetch("https://api.example.com"), { retries: 3 });
```

#### Metrics & Tracing

```typescript
import { metrics, startTrace, endSpan, addEvent, setAttribute, getTraceHeaders } from "@solumjs/core";

// Metrics
metrics.counter("http_requests_total", { method: "GET", path: "/api/users" }).inc();
metrics.histogram("http_request_duration_ms", 42);
metrics.gauge("active_connections", 5);

// Tracing
const traceId = startTrace("handleRequest");
setAttribute("http.method", "GET");
addEvent("request.received");
endSpan(traceId);

// Get trace headers for outgoing requests
const headers = getTraceHeaders();
```

#### I18n

```typescript
import { ResourceBundleMessageSource, I18nMessage, createMessageSource } from "@solumjs/core";

const messages = createMessageSource({
    baseDir: path.join(__dirname, "locales"),
    defaultLocale: "en",
});

const greeting = messages.getMessage("greeting", { name: "World" }, "en");
```

#### Batch Processing

```typescript
import { createJob, createStep, ArrayReader, FilterProcessor, ArrayWriter } from "@solumjs/core";

const job = createJob("importUsers")
    .step(createStep("readAndFilter")
        .reader(new ArrayReader(rawUsers))
        .processor(new FilterProcessor((user) => user.email != null))
        .writer(new ArrayWriter()))
    .build();

await job.execute();
```

#### Service Discovery

```typescript
import { registerInstance, discoverInstances, startRegistry } from "@solumjs/core";

startRegistry({ url: "http://consul:8500", serviceName: "user-service" });

registerInstance({
    id: "user-service-1",
    name: "user-service",
    host: "localhost",
    port: 3000,
    status: "UP",
});

const instances = await discoverInstances("order-service");
```

#### Event Sourcing

```typescript
import { AggregateRoot, saveEvents, loadAggregate, registerEventApplier } from "@solumjs/core";

registerEventApplier("OrderCreated", (aggregate, event) => {
    aggregate.status = "CREATED";
    aggregate.total = event.data.total;
});

class Order extends AggregateRoot {
    id: string;
    status: string;
    total: number;
}

const order = new Order();
order.apply("OrderCreated", { total: 100 });
await saveEvents(order.id, order.getUncommittedEvents());
```

---

### @solumjs/http

HTTP abstraction with router, REST decorators, guards, interceptors, pagination, session management, HTTP clients, and static file serving.

#### Route Definitions

```typescript
import { RestController, Get, Post, Put, Patch, Delete } from "@solumjs/http";

@RestController("/api/products")
export class ProductController {

    @Get("/")
    async listProducts() { return []; }

    @Get("/:id")
    async getProduct(@Param("id") id: string) { return {}; }

    @Post("/")
    async createProduct(@Body() dto: CreateProductDto) { return dto; }

    @Put("/:id")
    async updateProduct(@Param("id") id: string, @Body() dto: UpdateProductDto) { return dto; }

    @Patch("/:id")
    async patchProduct(@Param("id") id: string, @Body() dto: Partial<UpdateProductDto>) { return dto; }

    @Delete("/:id")
    async deleteProduct(@Param("id") id: string) { }
}
```

#### Parameter Decorators

```typescript
import { RestController, Get, Body, Param, Query, Header, CookieValue, CurrentUser, Req, Res, Next } from "@solumjs/http";

@RestController("/api")
export class ExampleController {

    @Get("/search")
    async search(
        @Query("q") query: string,
        @Query("page") page: number,
        @Header("Authorization") auth: string,
        @CookieValue("session") sid: string,
        @CurrentUser() user: User,
        @Req() req: SolumjsRequest,
        @Res() res: SolumjsResponse,
    ) { return { query, page }; }

    @Post("/data")
    async create(@Body() body: CreateDto) { return body; }
}
```

#### Guards

```typescript
import { Guard, ExecutionContext, UseGuards, Roles } from "@solumjs/http";
import { Bean, inject } from "@solumjs/core";

// Custom guard
@Bean("IApiKeyGuard")
export class ApiKeyGuard implements Guard {
    constructor(@inject("IConfigService") private config: ConfigService) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest();
        const apiKey = request.headers["x-api-key"];
        return apiKey === this.config.get("API_KEY");
    }
}

// Usage with multiple guards
@RestController("/api")
@UseGuards(ApiKeyGuard, JwtAuthGuard)
export class ApiController {

    @Get("/admin")
    @Roles("ADMIN")
    async adminEndpoint() { return "admin data"; }
}
```

#### Interceptors

```typescript
import { HandlerInterceptor, ExecutionContext, UseInterceptors } from "@solumjs/http";
import { Bean } from "@solumjs/core";

@Bean("LoggingInterceptor")
export class LoggingInterceptor implements HandlerInterceptor {
    async intercept(context: ExecutionContext, next: () => Promise<any>): Promise<any> {
        const start = Date.now();
        const result = await next();
        console.log(`Request took ${Date.now() - start}ms`);
        return result;
    }
}

@RestController("/api")
@UseInterceptors(LoggingInterceptor)
export class ApiController { /* ... */ }
```

#### Pagination

```typescript
import { PageRequest, Page, buildPage } from "@solumjs/http";

@RestController("/users")
export class UserController {

    @Get("/")
    async listUsers(@Query() pageRequest: PageRequest): Promise<Page<UserResponseDto>> {
        // pageRequest: { page, size, sort, direction, offset }
        const users = await this.userService.findAll(pageRequest);
        return users; // { data: [...], page, size, total, totalPages }
    }
}
```

#### Declarative HTTP Clients

```typescript
import { HttpClient, HttpGet, HttpPost, HttpPut, HttpDelete } from "@solumjs/http";

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

#### Session Management

```typescript
import { createSessionMiddleware, MemorySessionStore, RedisSessionStore } from "@solumjs/http";

// In-memory session (default)
app.use(createSessionMiddleware());

// Custom TTL
app.use(createSessionMiddleware({ ttlMs: 30 * 60 * 1000 }));

// Custom cookie name
app.use(createSessionMiddleware({ cookieName: "myapp.sid" }));

// Redis session store (for horizontal scaling)
import { connectRedisSessionStore } from "@solumjs/http";
const redisStore = await connectRedisSessionStore("redis://localhost:6379");
app.use(createSessionMiddleware({ store: redisStore }));

// Session usage in handlers
@RestController("/api")
export class SessionController {

    @Post("/login")
    async login(@Req() req: SolumjsRequest) {
        req.session.set("userId", "123");
        return { message: "Logged in" };
    }

    @Get("/me")
    async me(@Req() req: SolumjsRequest) {
        const userId = req.session.get("userId");
        return { userId };
    }
}
```

#### Static Files

```typescript
import { serveStatic } from "@solumjs/http";

app.use(serveStatic("public", { index: "index.html" }));
```

#### Response Status

```typescript
import { RestController, Post, ResponseStatus } from "@solumjs/http";

@RestController("/users")
export class UserController {

    @Post("/")
    @ResponseStatus(201)
    async createUser(@Body() dto: CreateUserDto) { return dto; }
}
```

---

### @solumjs/config

Application bootstrap, environment loading, YAML configuration, `@Value` decorator, OpenAPI/Swagger, and actuator endpoints.

#### createApplication

```typescript
import { createApplication, createEnvConfig, loadEnv } from "@solumjs/config";

loadEnv(); // loads .env file

createApplication({
    config: createEnvConfig(process.env),
    scanBaseDir: __dirname,
    scanDirs: ["controllers", "services", "repositories", "tasks", "advice"],
    bodyLimitBytes: 10 * 1024 * 1024, // 10MB
    onListen: (port) => console.log(`Server running on port ${port}`),
});
```

#### Environment Loading

```typescript
import { loadEnv, createEnvConfig } from "@solumjs/config";

// Load .env file
loadEnv();

// Access via process.env
const port = process.env.PORT || 3000;

// Or create a typed config
const config = createEnvConfig(process.env);
const dbHost = config.get("DB_HOST");
const dbPort = config.getNumber("DB_PORT");
const enableCache = config.getBoolean("ENABLE_CACHE");
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
```

```typescript
import { createYamlConfig } from "@solumjs/config";

// Reads config/application.yml (or config/application.yaml)
const yamlConfig = createYamlConfig();
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

#### OpenAPI / Swagger UI

```typescript
import { mountOpenApi } from "@solumjs/config";

// Serves GET /openapi.json and GET /docs
mountOpenApi(adapter, {
    title: "My API",
    version: "1.0.0",
    description: "API documentation",
    docsPath: "/docs",
    specPath: "/openapi.json",
});
```

#### @ApiProperty

```typescript
import { ApiProperty } from "@solumjs/config";
import { Required, IsEmail, MinLength, MaxLength } from "@solumjs/validation";

export class CreateUserDto {
    @ApiProperty({ description: "User full name", example: "John Doe" })
    @Required()
    @MinLength(2)
    @MaxLength(100)
    name!: string;

    @ApiProperty({ description: "User email", format: "email" })
    @Required()
    @IsEmail()
    email!: string;
}
```

#### Actuator Endpoints

```typescript
import { mountActuator } from "@solumjs/config";

// Serves (sensitive endpoints require authGuard or localhost access):
// GET /actuator/health — health checks (DB, memory)
// GET /actuator/info — application info
// GET /actuator/beans — registered beans (localhost only without authGuard)
// GET /actuator/mappings — route mappings (localhost only without authGuard)
// GET /actuator/env — sanitized environment (localhost only without authGuard)
// GET /actuator/loggers — log levels
// GET /actuator/metrics — JVM-style metrics
mountActuator(adapter, {
    basePath: "/actuator",
    authGuard: (req, res) => { /* verify auth */ return true; },
    healthchecks: [
        { name: "database", check: async () => ({ status: "UP" }) },
    ],
    info: { version: "1.0.0" },
});
```

#### Component Scanning

```typescript
createApplication({
    scanBaseDir: __dirname,
    scanDirs: [
        "config/beans",
        "repositories",
        "services",
        "controllers",
        "advice",
        "auth",
        "tasks",
    ],
});
```

---

### @solumjs/orm

Entity decorators, query builder, relations, schema builder, and multi-database support.

#### Entity Definition

```typescript
import { Entity, Column, ColumnType, PrimaryGeneratedColumn, CreatedAtColumn, UpdatedAtColumn, ManyToOne, OneToMany, ManyToMany, OneToOne, Index, VersionColumn } from "@solumjs/orm";

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

    @VersionColumn()
    public version!: number;

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
```

#### Lifecycle Callbacks

```typescript
import { PrePersist, PostPersist, PreUpdate, PostUpdate, PreRemove, PostRemove, PostLoad } from "@solumjs/orm";

@Entity("users")
export class User {
    // ... columns ...

    @PrePersist
    onPrePersist() { this.createdAt = new Date(); }

    @PostPersist
    onPostPersist() { /* after saved */ }

    @PreUpdate
    onPreUpdate() { this.updatedAt = new Date(); }

    @PostUpdate
    onPostUpdate() { /* after updated */ }

    @PreRemove
    onPreRemove() { /* before delete */ }

    @PostRemove
    onPostRemove() { /* after delete */ }

    @PostLoad
    onPostLoad() { /* after hydration */ }
}
```

#### Relations

```typescript
import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, OneToMany, OneToOne, ManyToMany, JoinColumn } from "@solumjs/orm";

@Entity("posts")
export class Post {
    @PrimaryGeneratedColumn(ColumnType.UUID)
    public readonly id!: string;

    @Column({ type: ColumnType.VARCHAR, length: 255 })
    public title!: string;

    @ManyToOne(() => User, (user) => user.posts)
    public author?: User;

    @OneToOne(() => Profile, (profile) => profile.user)
    @JoinColumn()
    public profile?: Profile;
}
```

#### Query Builder

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

#### Schema Sync

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

---

### @solumjs/database

Repository pattern, transactions, migrations, and driver factory.

#### BaseRepository

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

// Usage in service
@Bean("IUserService")
export class UserService {
    constructor(@inject("IUserRepository") private userRepo: IUserRepository) {}

    async findById(id: string): Promise<User> {
        const user = await this.userRepo.findById(id);
        if (!user) throw new NotFoundException(`User ${id} not found`);
        return user;
    }

    async findAll(): Promise<User[]> {
        return this.userRepo.findAll();
    }

    async save(user: User): Promise<User> {
        return this.userRepo.save(user);
    }

    async deleteById(id: string): Promise<void> {
        await this.userRepo.deleteById(id);
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
        const order = await this.orderRepo.save(new Order(dto));
        await this.inventoryRepo.decrement(dto.productId, dto.quantity);
        return order; // both operations in same transaction
    }
}
```

#### Driver Factory

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

#### Migrations

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

---

### @solumjs/auth

JWT authentication, guards, role-based access, `@PreAuthorize`, and OAuth2.

#### JWT Authentication

```typescript
import { JwtAuthGuard, RolesGuard, Roles } from "@solumjs/auth";
import { RestController, Get, Post, Body, UseGuards, CurrentUser } from "@solumjs/http";

@RestController("/users")
@UseGuards(JwtAuthGuard, RolesGuard)
export class UserController {

    @Get("/")
    @Roles("ADMIN")
    async listUsers() { return this.userService.findAll(); }

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

#### OAuth2

```typescript
import { OAuth2Client } from "@solumjs/auth";

const googleClient = new OAuth2Client({
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    redirectUri: "http://localhost:3000/auth/google/callback",
    authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenEndpoint: "https://oauth2.googleapis.com/token",
    scopes: ["openid", "email", "profile"],
});

// Generate authorization URL
const authUrl = googleClient.getAuthorizationUrl();

// Exchange code for tokens
const tokens = await googleClient.exchangeCode(code);

// Get user info
const userInfo = await googleClient.getUserInfo(tokens.accessToken);
```

---

### @solumjs/cache

Caching with decorator-based cache management.

#### Cache Decorators

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
        await this.productRepo.delete(id);
    }

    @CacheEvict({ key: "products:list", allEntries: true })
    async clearListCache(): Promise<void> {
        // Removes all matching entries
    }
}
```

#### Cache Key Expression

```typescript
// Supports {param} syntax resolved from method arguments
@Cacheable({ key: "user:{id}" })
async findById(id: string) { /* ... */ }

// Supports {0}, {1} positional syntax
@Cacheable({ key: "order:{0}:item:{1}" })
async getOrderItem(orderId: string, itemId: string) { /* ... */ }
```

#### InMemoryCacheStore

```typescript
import { InMemoryCacheStore } from "@solumjs/cache";

// Default: 1000 entries
const store = new InMemoryCacheStore();

// Custom max entries
const store = new InMemoryCacheStore(5000);
```

---

### @solumjs/events

Event-driven architecture with publish/subscribe pattern.

#### Publishing Events

```typescript
import { EventBus } from "@solumjs/events";
import { Bean, inject } from "@solumjs/core";

@Bean("IUserService")
export class UserService {
    constructor(@inject("IEventBus") private eventBus: EventBus) {}

    async createUser(dto: CreateUserDto): Promise<User> {
        const user = await this.userRepo.save(new User(dto));
        this.eventBus.publish("USER_CREATED", { userId: user.id, email: user.email });
        return user;
    }
}
```

#### Listening to Events

```typescript
import { EventListener, TransactionalEventListener, Async } from "@solumjs/events";

// Standard listener
export class UserCreatedListener {

    @EventListener("USER_CREATED")
    async handleUserCreated(payload: { userId: string; email: string }) {
        console.log(`User created: ${payload.email}`);
    }
}

// Transactional listener (runs after parent transaction commits)
export class UserAuditListener {

    @TransactionalEventListener("USER_CREATED")
    async handleAfterCommit(payload: { userId: string }) {
        await this.auditRepo.log("USER_CREATED", payload);
    }
}

// Async listener (does not block the publisher)
export class UserWelcomeListener {

    @EventListener("USER_CREATED")
    @Async()
    async sendWelcomeEmail(payload: { userId: string; email: string }) {
        await this.emailService.sendWelcome(payload.email);
    }
}
```

---

### @solumjs/schedule

Task scheduling with cron and interval support.

#### Cron Scheduling

```typescript
import { Scheduled, startScheduledTasks, stopScheduledTasks } from "@solumjs/schedule";
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

    @Scheduled("0 2 * * *", { zone: "America/New_York" }) // 2 AM EST
    async dailyCleanup() {
        console.log("Running daily cleanup...");
    }
}

// Start all scheduled tasks
startScheduledTasks();

// Stop all scheduled tasks
stopScheduledTasks();
```

#### Interval Scheduling

```typescript
@Bean("IHealthChecker")
export class HealthChecker {

    @Scheduled("30s") // Every 30 seconds
    async checkHealth() {
        console.log("Checking health...");
    }

    @Scheduled("5m") // Every 5 minutes
    async cleanupTempFiles() {
        console.log("Cleaning up...");
    }

    @Scheduled({ fixedDelay: 10000 }) // Fixed delay between executions
    async pollingTask() {
        console.log("Polling...");
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

**Interval Syntax:** `500ms`, `30s`, `5m`, `1h`

---

### @solumjs/validation

20+ validation decorators for DTOs.

#### Usage with Controllers

```typescript
import { RestController, Post, Body } from "@solumjs/http";
import {
    Required, IsEmail, IsOptional, MinLength, MaxLength,
    IsIn, IsUUID, IsNumber, Min, Max, IsArray,
    IsPositive, IsNegative, IsUrl, IsDateString, Pattern,
    IsString, IsBoolean, IsInt, NotEmpty, NotBlank, NotNull,
} from "@solumjs/validation";

export class CreateUserDto {
    @Required()
    @IsString()
    @MinLength(2)
    @MaxLength(100)
    name!: string;

    @Required()
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
    @Required()
    @IsUUID()
    productId!: string;

    @Required()
    @IsNumber()
    @IsPositive()
    quantity!: number;

    @IsOptional()
    @IsString()
    notes?: string;

    @IsOptional()
    @IsArray()
    tags?: string[];
}

@RestController("/users")
export class UserController {

    @Post("/")
    async createUser(@Body() dto: CreateUserDto) {
        return this.userService.createUser(dto);
    }
}
```

#### Available Validators

| Category | Decorators |
|----------|-----------|
| Type | `@IsString`, `@IsNumber`, `@IsBoolean`, `@IsArray`, `@IsInt` |
| Format | `@IsEmail`, `@IsUrl`, `@IsJWT`, `@IsUUID`, `@IsDateString` |
| Length | `@MinLength`, `@MaxLength`, `@Size` |
| Range | `@Min`, `@Max`, `@IsPositive`, `@IsNegative` |
| Constraint | `@IsIn`, `@Pattern`, `@NotEmpty`, `@NotBlank`, `@NotNull` |
| Optional | `@IsOptional` |
| Required | `@Required` |

---

### @solumjs/aop

Aspect-Oriented Programming with pointcut expressions.

```typescript
import { Aspect, Around, Before, After, AfterReturning, AfterThrowing, LogExecution, Auditable } from "@solumjs/aop";
import { Bean } from "@solumjs/core";

// Custom aspect
@Aspect("execution(* com.myapp.service.*.*(..))")
@Bean("PerformanceAspect")
export class PerformanceAspect {

    @Around("execution(* com.myapp.service.*.*(..))")
    async measurePerformance(joinPoint: any) {
        const start = Date.now();
        const result = await joinPoint.proceed();
        console.log(`${joinPoint.target.constructor.name}.${joinPoint.methodName} took ${Date.now() - start}ms`);
        return result;
    }
}

// Built-in logging
@Bean("IUserService")
export class UserService {

    @LogExecution({ level: "info", includeArgs: true, includeResult: false })
    async createUser(dto: CreateUserDto): Promise<User> {
        return this.userRepo.save(new User(dto));
    }
}

// Built-in audit logging
@Bean("IDocumentService")
export class DocumentService {

    @Auditable({ action: "UPDATE", resource: "Document" })
    async updateDocument(id: string, dto: UpdateDocumentDto): Promise<Document> {
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

### @solumjs/middlewares

Security, CORS, rate limiting, CSRF, error handling, and `@ControllerAdvice`.

#### Security Middleware

```typescript
import { createSecurityMiddlewares, requestLogger, errorHandler, notFoundHandler } from "@solumjs/middlewares";

// Apply all security middleware at once
app.use(createSecurityMiddlewares());

// Request logging
app.use(requestLogger());

// Global error handler
app.use(errorHandler());

// 404 handler (use as last middleware)
app.use(notFoundHandler());
```

#### Rate Limiting

```typescript
import { createSecurityMiddlewares } from "@solumjs/middlewares";

// Built into createSecurityMiddlewares() with defaults
app.use(createSecurityMiddlewares({
    rateLimit: { windowMs: 15 * 60 * 1000, max: 100 },
    cors: { origin: "*" },
}));
```

#### CSRF Protection

```typescript
import { csrfProtection } from "@solumjs/middlewares";

// secret is required (min 32 chars) — no insecure default
app.use(csrfProtection({ secret: "your-secure-csrf-secret-at-least-32-chars" }));

// With custom options
app.use(csrfProtection({
    secret: process.env.CSRF_SECRET,
    cookieName: "csrf-token",
    headerName: "x-csrf-token",
}));
```

#### Redis Rate Limiting (Distributed)

```typescript
import { createRedisRateLimit } from "@solumjs/middlewares";

const redisClient = await connectRedis({ url: "redis://localhost:6379" });

app.use(createRedisRateLimit({
    redis: redisClient,
    windowMs: 60000,
    max: 100,
}));
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
        req.log?.warn({ path: req.path }, err.message);
        return { status: "error", code: "NOT_FOUND", message: err.message };
    }

    @ExceptionHandler(BadRequestException)
    handleBadRequest(err: BadRequestException, req: SolumjsRequest) {
        return { status: "error", code: "BAD_REQUEST", message: err.message };
    }

    @ExceptionHandler(Error)
    handleGeneric(err: Error, req: SolumjsRequest) {
        req.log?.error({ path: req.path, err }, "Unhandled error");
        return { status: "error", code: "INTERNAL_ERROR", message: "Internal server error" };
    }
}
```

---

### @solumjs/testing

Testing utilities with mock support.

#### createTestApplication

```typescript
import { createTestApplication } from "@solumjs/testing";
import { UserController } from "./user.controller";
import { UserService } from "./user.service";

describe("UserController", () => {
    let app: any;

    beforeAll(async () => {
        app = await createTestApplication({
            scanDirs: ["controllers", "services"],
        });
    });

    afterAll(async () => {
        await app?.close();
    });

    it("should return health check", async () => {
        const response = await app.get("/health");
        expect(response.status).toBe(200);
    });
});
```

#### MockBean

```typescript
import { MockBean } from "@solumjs/testing";

describe("UserService", () => {
    let service: UserService;
    let mockUserRepo: any;

    beforeEach(() => {
        mockUserRepo = {
            findById: jest.fn(),
            save: jest.fn(),
            findByEmail: jest.fn(),
        };
        service = new UserService(mockUserRepo);
    });

    it("should throw NotFoundException for missing user", async () => {
        mockUserRepo.findById.mockResolvedValue(null);
        await expect(service.findById("nonexistent")).rejects.toThrow("not found");
    });
});
```

#### MockLogger

```typescript
import { MockLogger } from "@solumjs/testing";

const logger = MockLogger(); // silent logger for tests
```

---

### @solumjs/websocket

WebSocket handlers and STOMP protocol.

#### WebSocket Handler

```typescript
import { WebSocketHandler, MessageMapping } from "@solumjs/websocket";

@WebSocketHandler("/ws")
export class ChatHandler {

    onConnect(client: any) {
        console.log("Client connected");
    }

    @MessageMapping("/chat")
    onMessage(client: any, message: any) {
        // Broadcast to all connected clients
        this.broadcast({ type: "chat", data: message });
    }

    onDisconnect(client: any) {
        console.log("Client disconnected");
    }
}
```

#### STOMP Handler

```typescript
import { StompHandler, MessageMapping } from "@solumjs/websocket";

@StompHandler("/stomp")
export class StompChatHandler {

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

#### STOMP Frame Parsing

```typescript
import { parseStompFrame, serializeStompFrame } from "@solumjs/websocket";

const frame = parseStompFrame("SEND\ndestination:/queue/test\n\nHello World\n\0");
// { command: "SEND", headers: { destination: "/queue/test" }, body: "Hello World" }

const raw = serializeStompFrame({ command: "MESSAGE", headers: { destination: "/queue/test" }, body: "Hi" });
```

---

### @solumjs/email

SMTP email sending with template engine.

#### SMTP Configuration

```typescript
import { SmtpEmail, MailSend, MailService, TemplateEngine } from "@solumjs/email";
import { Bean, inject } from "@solumjs/core";

@Bean("ISmtpEmail")
@SmtpEmail({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    auth: { user: "you@gmail.com", pass: "app-password" },
})
export class AppEmailClient {}
```

#### Sending Emails

```typescript
@Bean("INotificationService")
export class NotificationService {

    constructor(@inject("IMailService") private mailService: MailService) {}

    async sendWelcome(user: User) {
        await this.mailService.send({
            to: user.email,
            subject: "Welcome!",
            html: `<h1>Hello ${user.name}!</h1><p>Welcome to our platform.</p>`,
        });
    }

    async sendWithAttachments(user: User) {
        await this.mailService.send({
            to: user.email,
            subject: "Your Report",
            html: "<p>Please find attached your report.</p>",
            attachments: [
                { filename: "report.pdf", content: pdfBuffer, contentType: "application/pdf" },
            ],
        });
    }
}
```

#### Template Engine

```typescript
import { TemplateEngine } from "@solumjs/email";

const engine = new TemplateEngine();

engine.register("welcome", "Hello {{name}}, welcome to {{platform}}!");

const html = engine.render("welcome", { name: "John", platform: "SolumJS" });
// "Hello John, welcome to SolumJS!"
```

#### Test Mode

```typescript
import { enableTestMode, getSentEmails, clearSentEmails } from "@solumjs/email";

// Enable test mode (no actual emails sent)
enableTestMode();

// Send email (intercepted)
await mailService.send({ to: "test@example.com", subject: "Test", html: "Hello" });

// Retrieve sent emails
const emails = getSentEmails();
expect(emails.length).toBe(1);
expect(emails[0].to).toBe("test@example.com");

// Clear
clearSentEmails();
```

---

### @solumjs/cli

Command-line interface for scaffolding and utilities.

#### Create New Project

```bash
npx solum new my-app
```

Generates a complete project structure with:
- `package.json` with all dependencies
- `tsconfig.json` configured for decorators
- `jest.config.js` with path mapping
- `src/app.ts` bootstrap file
- `src/controllers/`, `src/services/`, `src/repositories/`
- `src/entities/`, `src/dto/`, `src/advice/`
- `src/database/` migration and schema sync scripts

#### Generate Files

```bash
solum generate controller Product    # Creates product.controller.ts
solum generate service Product       # Creates product.service.ts
solum generate entity Product        # Creates product.entity.ts
solum generate repository Product    # Creates product.repository.ts
solum generate dto CreateProduct     # Creates create-product.dto.ts
solum generate middleware Auth       # Creates auth.middleware.ts
solum generate guard ApiKey          # Creates api-key.guard.ts
solum generate listener ProductCreated  # Creates product-created.listener.ts
solum generate filter GlobalException   # Creates global-exception.filter.ts
```

#### Run Tests

```bash
solum test
```

#### Run Migrations

```bash
solum db:migrate
```

#### Show Version

```bash
solum --version
```

---

## Example Application

The [`backend-example`](./packages/backend-example) package demonstrates a complete API.

**src/app.ts:**
```typescript
import "@solumjs/core";
import { createApplication, createEnvConfig, loadEnv } from "@solumjs/config";

loadEnv();

createApplication({
    config: createEnvConfig(process.env),
    scanBaseDir: __dirname,
    scanDirs: ["config/beans", "repositories", "services", "controllers", "advice", "auth", "tasks"],
    bodyLimitBytes: 10 * 1024,
});
```

**src/controllers/user.controller.ts:**
```typescript
import { RestController, Get, Post, Put, Delete, Body, Param, UseGuards, CurrentUser, ResponseStatus } from "@solumjs/http";
import { JwtAuthGuard, RolesGuard, Roles } from "@solumjs/auth";
import { Cacheable, CacheEvict } from "@solumjs/cache";
import { CreateUserDto } from "@dto/create-user.dto";

@RestController("/users")
@UseGuards(JwtAuthGuard, RolesGuard)
export class UserController {
    constructor(@inject("IUserService") private readonly userService: IUserService) {}

    @Get("/")
    @Roles("ADMIN")
    async listUsers() { return this.userService.findAll(); }

    @Get("/:id")
    @Cacheable({ key: "user:{id}", ttl: 300 })
    async getUser(@Param("id") id: string) { return this.userService.findById(id); }

    @Post("/")
    @ResponseStatus(201)
    async createUser(@Body() dto: CreateUserDto) { return this.userService.createUser(dto); }

    @Delete("/:id")
    @Roles("ADMIN")
    @CacheEvict({ key: "user:{id}" })
    async deleteUser(@Param("id") id: string) { return this.userService.deleteUser(id); }
}
```

**NPM Scripts:**
```json
{
    "scripts": {
        "dev": "ts-node-dev --respawn --transpile-only -r tsconfig-paths/register src/app.ts",
        "build": "tsc",
        "start": "node -r ./prod-paths.js dist/app.js",
        "test": "jest",
        "migrate": "ts-node -r tsconfig-paths/register src/database/migrate.ts up",
        "migrate:down": "ts-node -r tsconfig-paths/register src/database/migrate.ts down",
        "migrate:status": "ts-node -r tsconfig-paths/register src/database/migrate.ts status",
        "migrate:generate": "ts-node -r tsconfig-paths/register src/database/generate-migration.ts",
        "schema:sync": "ts-node -r tsconfig-paths/register src/database/sync-schema.ts validate",
        "schema:sync:update": "ts-node -r tsconfig-paths/register src/database/sync-schema.ts update"
    }
}
```

---

## License

MIT License - see [LICENSE](./LICENSE) for details.
