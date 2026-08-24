# @solumjs/config

Configuration and OpenAPI/Swagger support for SolumJS.

## Installation

```bash
npm install @solumjs/config
```

## Features

- Environment variable loading
- YAML configuration support
- Profile-based configuration
- OpenAPI/Swagger UI
- Actuator endpoints
- `@Value()` decorator for DI
- `@ApiProperty()` decorator

## Usage

```typescript
import { createApplication, mountOpenApi, actuatorMiddleware } from "@solumjs/config";

const app = createApplication({ useYamlConfig: true });
mountOpenApi(app.adapter);
app.use(actuatorMiddleware());
```
