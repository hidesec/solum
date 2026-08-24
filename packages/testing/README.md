# @solumjs/testing

Testing utilities for SolumJS applications.

## Installation

```bash
npm install --save-dev @solumjs/testing
```

## Features

- Test module builder
- HTTP client testing
- Mock services
- Database test helpers

## Usage

```typescript
import { TestModule } from "@solumjs/testing";

const testModule = TestModule.create({
    controllers: [UserController],
    providers: [UserService],
    overrides: [
        { provide: UserRepository, useValue: mockUserRepo },
    ],
});

const app = testModule.createNestApplication();
```
