# @solumjs/database

Database connection management and migration runner for SolumJS.

## Installation

```bash
npm install @solumjs/database
```

## Features

- Connection pooling
- Multiple database drivers
- Migration runner
- Transaction support

## Usage

```typescript
import { DatabaseModule, runMigrations } from "@solumjs/database";

// Configure via environment variables
// DATABASE_URL=postgres://user:pass@localhost:5432/mydb

await runMigrations();
```
