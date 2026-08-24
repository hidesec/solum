# @solumjs/core

The foundation package of the SolumJS framework. Provides the IoC container, decorators, HTTP exceptions, resilience patterns, metrics, tracing, i18n, batch processing, service discovery, configuration server, event sourcing, and structured logging.

## Install

```bash
npm install @solumjs/core
```

## Quick Start

```typescript
import "@solumjs/core";
```

## IoC Container

```typescript
import { container, inject, Bean } from "@solumjs/core";

// Register beans
container.register("IConfig", { port: 3000 });

// Resolve beans
const config = container.resolve<Record<string, unknown>>("IConfig");

// Resolve all implementations of a token
const allListeners = container.resolveAll("IEventListener");

// Clear container (for testing)
container.clear();
```

## @Bean Decorator

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
```

## @Primary, @Order, @ConditionalOnProperty

```typescript
import { Bean, Primary, Order, ConditionalOnProperty } from "@solumjs/core";

// Primary — preferred when multiple implementations exist
@Bean("ICache")
@Primary()
export class RedisCache implements ICache {}

// Order — execution order
@Order(1)
@Bean("IFirstService")
export class FirstService {}

// Conditional — only register if env var is set
@Bean("IRedisCache")
@ConditionalOnProperty("REDIS_URL")
export class RedisCache {}
```

## @Profile

```typescript
import { Bean, Profile } from "@solumjs/core";

@Bean("IDevDatabase")
@Profile("dev")
export class DevDatabase {}

@Bean("IProdDatabase")
@Profile("prod")
export class ProdDatabase {}
```

## @Configuration and @Bean Methods

```typescript
import { Configuration, Bean } from "@solumjs/core";

@Configuration
export class AppConfig {
    @Bean("IDatabaseConfig")
    createDbConfig() {
        return { host: "localhost", port: 5432 };
    }

    @Bean("IMailerConfig")
    createMailerConfig() {
        return { smtp: "smtp.gmail.com" };
    }
}
```

## @PostConstruct and @PreDestroy

```typescript
import { Bean, PostConstruct, PreDestroy } from "@solumjs/core";

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

## @Autowired

```typescript
import { Bean, inject } from "@solumjs/core";

@Bean("IOrderService")
export class OrderService {
    constructor(@inject("IUserService") private userService: IUserService) {}
}
```

## HTTP Exceptions

```typescript
import {
    HttpException,
    BadRequestException,
    UnauthorizedException,
    ForbiddenException,
    NotFoundException,
    ConflictException,
    ServiceUnavailableException,
    PayloadTooLargeException,
    InvalidQueryParameterException,
} from "@solumjs/core";

throw new NotFoundException(`User ${id} not found`);
throw new ConflictException(`Email ${email} is already registered`);
throw new BadRequestException("Invalid input");
```

## Structured Logger

```typescript
import { Logger, createLogger, getLogger, setGlobalLogger } from "@solumjs/core";

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

## Resilience (Retry & Circuit Breaker)

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

## Metrics & Tracing

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

## I18n

```typescript
import { ResourceBundleMessageSource, createMessageSource } from "@solumjs/core";
import path from "path";

const messages = createMessageSource({
    baseDir: path.join(__dirname, "locales"),
    defaultLocale: "en",
});

const greeting = messages.getMessage("greeting", { name: "World" }, "en");
```

## Batch Processing

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

## Service Discovery

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

## Event Sourcing

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

## Reflect Metadata Polyfill

SolumJS includes a built-in `reflect-metadata` polyfill. Simply import the package to enable decorator metadata.

## License

MIT
