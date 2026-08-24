# @solumjs/http

HTTP abstraction, router, and Node.js adapter for SolumJS.

## Installation

```bash
npm install @solumjs/http
```

## Features

- HTTP server abstraction
- Route decorators (`@RestController`, `@Get`, `@Post`, etc.)
- Parameter decorators (`@Body`, `@Param`, `@Query`, etc.)
- Guard decorators
- Interceptors
- Session management
- Cookie handling
- Multipart support
- Static file serving
- Redis session store

## Usage

```typescript
import { RestController, Get, Post, Body, Param, Query } from "@solumjs/http";

@RestController("/users")
class UserController {
    @Get("/")
    findAll(@Query("page") page: number) {
        return { users: [], page };
    }

    @Get("/:id")
    findOne(@Param("id") id: string) {
        return { id };
    }

    @Post("/")
    create(@Body() user: CreateUserDto) {
        return user;
    }
}
```
