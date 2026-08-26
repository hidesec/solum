# solumjs

A modular, decorator-driven backend framework for Node.js and TypeScript.

Inspired by Java Spring Boot. Zero runtime dependencies in core.

## Install

```bash
npm install -g solumjs
```

## Quick Start

```bash
# Create a new project
solum new my-app
cd my-app
npm install
npm run dev
```

## What's Included

This meta package installs all 16 SolumJS packages:

| Package | Description |
|---------|-------------|
| `@solumjs/core` | IoC container, decorators, HTTP exceptions, resilience, metrics, tracing, i18n, batch, discovery, logger |
| `@solumjs/http` | Router, REST decorators, guards, interceptors, pagination, session, HTTP clients |
| `@solumjs/config` | `createApplication()`, `.env`/YAML loading, `@Value`, OpenAPI/Swagger, actuator |
| `@solumjs/orm` | Entity/column decorators, query builder, relations, schema sync, 5 database dialects |
| `@solumjs/database` | `BaseRepository`, `@Transactional`, migrations, driver factory |
| `@solumjs/auth` | JWT service, `JwtAuthGuard`, `RolesGuard`, `@PreAuthorize`, OAuth2 |
| `@solumjs/cache` | `@Cacheable`, `@CacheEvict`, `@CachePut`, InMemory/Redis store |
| `@solumjs/events` | `EventBus`, `@EventListener`, `@TransactionalEventListener` |
| `@solumjs/schedule` | `@Scheduled` with cron/interval support |
| `@solumjs/validation` | 20+ validation decorators |
| `@solumjs/aop` | `@Aspect`, `@Around`, `@Before`, `@After`, `@LogExecution` |
| `@solumjs/middlewares` | Security headers, CORS, rate limiting, CSRF, `@ControllerAdvice` |
| `@solumjs/testing` | `createTestApplication()`, `@MockBean`, `MockLogger` |
| `@solumjs/websocket` | WebSocket handlers, STOMP protocol |
| `@solumjs/email` | SMTP client, template engine, test mode |
| `@solumjs/cli` | `solum new`, `solum generate`, `solum test`, `solum db:migrate` |

## CLI Commands

```bash
solum new <project>              # Scaffold a new project
solum generate <type> <name>     # Generate controller, service, entity, etc.
solum test                       # Run tests
solum db:migrate                 # Run database migrations
solum --version                  # Show version
```

## Generate Types

```bash
solum generate controller user
solum generate service user
solum generate entity user
solum generate repository user
solum generate dto createUser
solum generate middleware auth
solum generate guard apiKey
solum generate listener userCreated
solum generate filter globalException
```

## Upgrade

```bash
npm update -g solumjs
```

## Individual Installation

If you only need specific packages:

```bash
npm install @solumjs/core @solumjs/http @solumjs/config
```

## Docs

- [Main README](../../README.md)
- [Migration Guide](../../docs/migration-guide.md)
- Each package has its own README in `packages/<name>/README.md`

## License

MIT
