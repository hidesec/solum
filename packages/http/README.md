# @solumjs/http

HTTP abstraction with router, REST decorators, guards, interceptors, pagination, session management, HTTP clients, and static file serving.

## Install

```bash
npm install @solumjs/http
```

## Route Definitions

```typescript
import { RestController, Get, Post, Put, Patch, Delete, Param, Body, Query, Header, CookieValue, CurrentUser, Req, Res, Next, ResponseStatus } from "@solumjs/http";

@RestController("/api/products")
export class ProductController {

    @Get("/")
    async listProducts() { return []; }

    @Get("/:id")
    async getProduct(@Param("id") id: string) { return {}; }

    @Post("/")
    @ResponseStatus(201)
    async createProduct(@Body() dto: CreateProductDto) { return dto; }

    @Put("/:id")
    async updateProduct(@Param("id") id: string, @Body() dto: UpdateProductDto) { return dto; }

    @Patch("/:id")
    async patchProduct(@Param("id") id: string, @Body() dto: Partial<UpdateProductDto>) { return dto; }

    @Delete("/:id")
    async deleteProduct(@Param("id") id: string) { }
}
```

## Parameter Decorators

```typescript
import { RestController, Get, Body, Param, Query, Header, CookieValue, CurrentUser, Req, Res, Next, Valid } from "@solumjs/http";

@RestController("/api")
export class ExampleController {

    @Get("/search")
    async search(
        @Query("q") query: string,
        @Query("page") page: number,
        @Header("Authorization") auth: string,
        @CookieValue("session") sid: string,
        @CurrentUser() user: User,
        @Req() req: SolumjsRequest,
        @Res() res: SolumjsResponse,
    ) { return { query, page }; }

    @Post("/data")
    async create(@Body() body: CreateDto) { return body; }
}
```

## Guards

```typescript
import { CanActivate, ExecutionContext, UseGuards, Roles } from "@solumjs/http";
import { Bean } from "@solumjs/core";

// Custom guard
@Bean("IApiKeyGuard")
export class ApiKeyGuard implements CanActivate {
    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest();
        const apiKey = request.headers["x-api-key"];
        return apiKey === process.env.API_KEY;
    }
}

// Usage
@RestController("/api")
@UseGuards(ApiKeyGuard)
export class ApiController {

    @Get("/admin")
    @Roles("ADMIN")
    async adminEndpoint() { return "admin data"; }
}
```

## Interceptors

```typescript
import { HandlerInterceptor, ExecutionContext, UseInterceptors } from "@solumjs/http";
import { Bean } from "@solumjs/core";

@Bean("LoggingInterceptor")
export class LoggingInterceptor implements HandlerInterceptor {
    async intercept(context: ExecutionContext, next: () => Promise<any>): Promise<any> {
        const start = Date.now();
        const result = await next();
        console.log(`Request took ${Date.now() - start}ms`);
        return result;
    }
}

@RestController("/api")
@UseInterceptors(LoggingInterceptor)
export class ApiController { /* ... */ }
```

## Pagination

```typescript
import { PageRequest, Page } from "@solumjs/http";

@RestController("/users")
export class UserController {

    @Get("/")
    async listUsers(@Query() pageRequest: PageRequest): Promise<Page<UserResponseDto>> {
        const users = await this.userService.findAll(pageRequest);
        return users; // { data: [...], page, size, total, totalPages }
    }
}
```

## Declarative HTTP Clients

```typescript
import { HttpClient, HttpGet, HttpPost, HttpPut, HttpDelete } from "@solumjs/http";

@HttpClient("jsonplaceholder")
@BaseUrl("https://jsonplaceholder.typicode.com")
@Timeout(5000)
export interface TodoClient {

    @HttpGet("/todos/:id")
    getTodo(@Param("id") id: number): Promise<Todo>;

    @HttpPost("/todos")
    createTodo(@Body() todo: CreateTodoDto): Promise<Todo>;

    @HttpPut("/todos/:id")
    updateTodo(@Param("id") id: number, @Body() todo: UpdateTodoDto): Promise<Todo>;

    @HttpDelete("/todos/:id")
    deleteTodo(@Param("id") id: number): Promise<void>;
}
```

## Session Management

```typescript
import { createSessionMiddleware, MemorySessionStore } from "@solumjs/http";

// In-memory session
app.use(createSessionMiddleware());

// Custom TTL
app.use(createSessionMiddleware({ ttlMs: 30 * 60 * 1000 }));

// Custom cookie name
app.use(createSessionMiddleware({ cookieName: "myapp.sid" }));

// Redis session store
import { connectRedisSessionStore } from "@solumjs/http";
const redisStore = await connectRedisSessionStore("redis://localhost:6379");
app.use(createSessionMiddleware({ store: redisStore }));
```

## Cookies

```typescript
import { setCookie, clearCookie } from "@solumjs/http";

// Set cookie
setCookie(res, "session", "abc123", { httpOnly: true, maxAge: 3600 });

// Clear cookie
clearCookie(res, "session");
```

## Static Files

```typescript
import { serveStatic } from "@solumjs/http";

app.use(serveStatic("public", { index: "index.html" }));
```

## Request/Response Types

```typescript
import { SolumjsRequest, SolumjsResponse, UploadedFile, Session, SolumjsLogger } from "@solumjs/http";

// SolumjsRequest
// - method, path, params, query, headers, body
// - log: SolumjsLogger
// - raw: IncomingMessage
// - cookies, files, session

// SolumjsResponse
// - status(code), json(data), send(text), end()
// - raw: ServerResponse
```

## License

MIT
