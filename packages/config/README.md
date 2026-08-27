# @solumjs/config

Application bootstrap, environment loading, YAML configuration, `@Value` decorator, OpenAPI/Swagger, actuator endpoints, and component scanning.

## Install

```bash
npm install @solumjs/config
```

## createApplication

```typescript
import { createApplication, createEnvConfig, loadEnv } from "@solumjs/config";

loadEnv(); // loads .env file

createApplication({
    config: createEnvConfig(process.env),
    scanBaseDir: __dirname,
    scanDirs: ["controllers", "services", "repositories", "tasks", "advice"],
    bodyLimitBytes: 10 * 1024 * 1024,
    onListen: (port) => console.log(`Server running on port ${port}`),
});
```

## Environment Loading

```typescript
import { loadEnv, createEnvConfig } from "@solumjs/config";

loadEnv();

const config = createEnvConfig(process.env);
const dbHost = config.get("DB_HOST");
const dbPort = config.getNumber("DB_PORT");
const enableCache = config.getBoolean("ENABLE_CACHE");
```

## YAML Configuration

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

const yamlConfig = createYamlConfig();
```

## @Value Decorator

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

## OpenAPI / Swagger UI

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

## @ApiProperty

```typescript
import { ApiProperty } from "@solumjs/config";

export class CreateUserDto {
    @ApiProperty({ description: "User full name", example: "John Doe" })
    name!: string;

    @ApiProperty({ description: "User email", format: "email" })
    email!: string;
}
```

## Actuator Endpoints

```typescript
import { mountActuator } from "@solumjs/config";

// Serves (sensitive endpoints require authGuard or localhost access):
// GET /actuator/health — health checks
// GET /actuator/info — application info
// GET /actuator/beans — registered beans (localhost only without authGuard)
// GET /actuator/mappings — route mappings (localhost only without authGuard)
// GET /actuator/env — sanitized environment (localhost only without authGuard)
// GET /actuator/loggers — log levels
// GET /actuator/metrics — metrics
mountActuator(adapter, {
    basePath: "/actuator",
    authGuard: (req, res) => { /* verify auth */ return true; },
    healthchecks: [
        { name: "database", check: async () => ({ status: "UP" }) },
    ],
    info: { version: "1.0.0" },
});
```

## Component Scanning

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

## Profile Configuration

```typescript
import { ProfileConfig, ProfileActive } from "@solumjs/config";

@ProfileActive("dev")
export class DevConfig {}

@ProfileActive("prod")
export class ProdConfig {}
```

## License

MIT
