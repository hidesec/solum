# @solumjs/core

Core module for SolumJS — IoC container, decorators, and base framework.

## Installation

```bash
npm install @solumjs/core
```

## Features

- IoC Container with DI
- `@Autowired` decorator
- `@Bean` decorator
- `@Profile` decorator
- HTTP exceptions
- Structured logging

## Usage

```typescript
import { container, Autowired, Logger } from "@solumjs/core";

class MyService {
    private logger = new Logger("MyService");

    doWork() {
        this.logger.info("Working...");
    }
}

container.register(MyService);
const service = container.resolve(MyService);
```
