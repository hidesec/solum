# @solumjs/cli

Command-line interface for scaffolding and utilities.

## Install

```bash
npm install -g @solumjs/cli
```

## Commands

### Create New Project

```bash
solum new <project-name>
```

Generates a complete project structure:
- `package.json` with all dependencies
- `tsconfig.json` configured for decorators
- `jest.config.js` with path mapping
- `src/app.ts` bootstrap file
- `src/controllers/` — REST controllers
- `src/services/` — Service classes
- `src/repositories/` — Repository classes
- `src/entities/` — ORM entities
- `src/dto/` — DTO interfaces
- `src/advice/` — Exception handlers
- `src/database/` — Migration and schema scripts

```bash
solum new my-api
cd my-api
npm install
npm run dev
```

### Generate Files

```bash
solum generate <type> <name>
```

| Type | Description |
|------|-------------|
| `controller` | REST controller class |
| `service` | Service class |
| `repository` | Repository with BaseRepository |
| `entity` | ORM entity class |
| `dto` | DTO interface |
| `middleware` | Middleware function |
| `guard` | Guard class |
| `listener` | Event listener class |
| `filter` | Exception filter class |

```bash
solum generate controller product
solum generate service product
solum generate entity product
solum generate repository product
solum generate dto createProduct
solum generate middleware auth
solum generate guard apiKey
solum generate listener productCreated
solum generate filter globalException
```

### Run Tests

```bash
solum test
```

Runs `npm test` in the current project directory.

### Run Migrations

```bash
solum db:migrate
```

Runs database migrations configured in the project.

### Show Version

```bash
solum --version
solum -v
solum version
```

## NPM Scripts (Generated Projects)

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

## License

MIT
