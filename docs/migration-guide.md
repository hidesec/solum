# Migration Guide: Express → SolumJS

This guide helps you migrate an Express.js application to SolumJS.

## Overview

SolumJS is a TypeScript-first backend framework inspired by Spring Boot. It provides:
- Decorator-based routing and dependency injection
- Built-in ORM, validation, caching, and authentication
- Zero runtime dependencies for core features
- Type safety throughout the application

## Prerequisites

- Node.js >= 18
- TypeScript >= 5

## Step 1: Install SolumJS

```bash
# Create new SolumJS project
solum new my-app

# Or install in existing project
npm install solumjs
```

## Step 2: Project Structure

**Express:**
```
src/
  routes/
    users.js
  controllers/
    userController.js
  models/
    user.js
  middleware/
    auth.js
  app.js
```

**SolumJS:**
```
src/
  controllers/
    user.controller.ts
  services/
    user.service.ts
  repositories/
    user.repository.ts
  entities/
    user.entity.ts
  dto/
    create-user.dto.ts
  guards/
    auth.guard.ts
  main.ts
```

## Step 3: Routing

**Express:**
```javascript
const express = require("express");
const router = express.Router();

router.get("/users", async (req, res) => {
    const users = await User.findAll();
    res.json(users);
});

router.get("/users/:id", async (req, res) => {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: "Not found" });
    res.json(user);
});

router.post("/users", async (req, res) => {
    const user = await User.create(req.body);
    res.status(201).json(user);
});
```

**SolumJS:**
```typescript
import { RestController, Get, Post, Body, Param, Query } from "@solumjs/http";
import { UserService } from "../services/user.service";

@RestController("/users")
class UserController {
    constructor(private readonly userService: UserService) {}

    @Get("/")
    async findAll(@Query("page") page: number = 1) {
        return this.userService.findAll(page);
    }

    @Get("/:id")
    async findOne(@Param("id") id: string) {
        const user = await this.userService.findById(id);
        if (!user) throw new NotFoundException("User not found");
        return user;
    }

    @Post("/")
    async create(@Body() createUserDto: CreateUserDto) {
        return this.userService.create(createUserDto);
    }
}
```

## Step 4: Middleware

**Express:**
```javascript
// auth.js
function authMiddleware(req, res, next) {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ error: "Unauthorized" });

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        res.status(401).json({ error: "Invalid token" });
    }
}

app.use("/api", authMiddleware);
```

**SolumJS:**
```typescript
// auth.guard.ts
import { Guard, ExecutionContext } from "@solumjs/http";
import { JwtService } from "@solumjs/auth";

class AuthGuard implements Guard {
    constructor(private readonly jwtService: JwtService) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const token = context.getRequest().headers.authorization?.split(" ")[1];
        if (!token) throw new UnauthorizedException("Missing token");

        const payload = this.jwtService.verify(token);
        context.getRequest().user = payload;
        return true;
    }
}

// user.controller.ts
@UseGuards(AuthGuard)
@RestController("/users")
class UserController {
    // Protected routes
}
```

## Step 5: Error Handling

**Express:**
```javascript
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(err.status || 500).json({
        error: err.message || "Internal Server Error",
    });
});
```

**SolumJS:**
```typescript
import { ExceptionFilter, Catch, HttpException } from "@solumjs/http";

@Catch(HttpException)
class HttpExceptionFilter implements ExceptionFilter {
    catch(exception: HttpException, host: ArgumentsHost) {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse();
        const status = exception.getStatus();
        const message = exception.getResponse();

        response.status(status).json({
            statusCode: status,
            message: typeof message === "string" ? message : message.message,
            timestamp: new Date().toISOString(),
        });
    }
}

app.useGlobalFilters(new HttpExceptionFilter());
```

## Step 6: Validation

**Express:**
```javascript
const { body, validationResult } = require("express-validator");

router.post("/users", [
    body("email").isEmail(),
    body("name").isLength({ min: 2 }),
], (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    // Create user
});
```

**SolumJS:**
```typescript
// create-user.dto.ts
import { Required, IsEmail, MinLength, MaxLength } from "@solumjs/validation";

export class CreateUserDto {
    @Required()
    @IsEmail()
    email!: string;

    @Required()
    @MinLength(2)
    @MaxLength(100)
    name!: string;
}

// user.controller.ts
@Post("/")
async create(@Body(Validate) createUserDto: CreateUserDto) {
    return this.userService.create(createUserDto);
}
```

## Step 7: Database

**Express (with Knex/Sequelize):**
```javascript
const knex = require("knex")({
    client: "pg",
    connection: process.env.DATABASE_URL,
});

router.get("/users", async (req, res) => {
    const users = await knex("users").select("*");
    res.json(users);
});
```

**SolumJS (with built-in ORM):**
```typescript
// user.entity.ts
import { Entity, Column, PrimaryGeneratedColumn } from "@solumjs/orm";

@Entity("users")
class User {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column("varchar", { length: 255 })
    name!: string;

    @Column("varchar", { length: 255 })
    email!: string;
}

// user.repository.ts
import { BaseRepository } from "@solumjs/database";

class UserRepository extends BaseRepository<User> {
    entityClass = User;
}
```

## Step 8: Configuration

**Express:**
```javascript
require("dotenv").config();
const port = process.env.PORT || 3000;
```

**SolumJS:**
```typescript
import { createApplication } from "@solumjs/config";

const app = createApplication();
const port = process.env.PORT || 3000;
app.listen(port);
```

## Step 9: Testing

**Express:**
```javascript
const request = require("supertest");
const app = require("../app");

describe("GET /users", () => {
    it("should return users", async () => {
        const res = await request(app).get("/users");
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
    });
});
```

**SolumJS:**
```typescript
import { TestModule } from "@solumjs/testing";

describe("UserController", () => {
    let app: any;

    beforeAll(async () => {
        const testModule = TestModule.create({
            controllers: [UserController],
            providers: [UserService],
        });
        app = testModule.createNestApplication();
    });

    it("GET /users", async () => {
        const response = await app.get("/users");
        expect(response.status).toBe(200);
        expect(Array.isArray(response.body)).toBe(true);
    });
});
```

## Key Differences

| Feature | Express | SolumJS |
|---------|---------|---------|
| Routing | `router.get()` | `@Get()` decorator |
| DI | Manual | `@Autowired()` |
| Validation | express-validator | `@Required()`, `@IsEmail()` |
| ORM | Knex/Sequelize | Built-in ORM |
| Auth | Middleware | Guards |
| Error Handling | Middleware | `@Catch()` |
| Config | dotenv | Built-in config |

## Need Help?

- Check the [README](../README.md)
- Browse package-level READMEs in each `packages/*/README.md`
