# @solumjs/middlewares

Security headers, CORS, rate limiting, CSRF protection, error handling, and `@ControllerAdvice`.

## Install

```bash
npm install @solumjs/middlewares
```

## Security Middleware

```typescript
import { createSecurityMiddlewares, requestLogger, errorHandler, notFoundHandler } from "@solumjs/middlewares";

// Apply all security middleware at once (security headers + CORS + rate limiting)
app.use(createSecurityMiddlewares());

// Request logging
app.use(requestLogger());

// Global error handler
app.use(errorHandler());

// 404 handler (use as last middleware)
app.use(notFoundHandler());
```

## createSecurityMiddlewares

Applies 3 middleware in order:
1. **Security headers** — CSP, HSTS, X-Frame-Options, etc.
2. **CORS** — reads `CORS_ORIGIN` from env
3. **Rate limiting** — reads `RATE_LIMIT_MAX` from env (default 100 per 15 min)

```typescript
app.use(createSecurityMiddlewares());
```

## CORS

Configured via `CORS_ORIGIN` environment variable.

```bash
# .env
CORS_ORIGIN=https://myapp.com
RATE_LIMIT_MAX=200
```

## Rate Limiting

```typescript
import { createRateLimit } from "@solumjs/middlewares";

app.use(createRateLimit({ windowMs: 15 * 60 * 1000, max: 100 }));
```

## Redis Rate Limiting (Distributed)

```typescript
import { createRedisRateLimit } from "@solumjs/middlewares";

const redisClient = await connectRedis({ url: "redis://localhost:6379" });

app.use(createRedisRateLimit({
    redis: redisClient,
    windowMs: 60000,
    max: 100,
    keyPrefix: "api:",         // optional
    trustProxy: true,          // optional, uses X-Forwarded-For
}));
```

## CSRF Protection

```typescript
import { csrfProtection } from "@solumjs/middlewares";

// secret is required (min 32 chars) — uses timing-safe comparison
app.use(csrfProtection({ secret: process.env.CSRF_SECRET }));

// With custom options
app.use(csrfProtection({
    secret: process.env.CSRF_SECRET,
    cookieName: "csrf-token",
    headerName: "x-csrf-token",
    ttlSeconds: 3600,
    sameSite: "lax",
    secure: true,
    ignoreMethods: ["GET", "HEAD", "OPTIONS"],
}));
```

## @ControllerAdvice (Global Error Handling)

```typescript
import { ControllerAdvice, ExceptionHandler } from "@solumjs/middlewares";
import { SolumjsRequest } from "@solumjs/http";
import { NotFoundException, BadRequestException } from "@solumjs/core";

@ControllerAdvice
export class GlobalExceptionAdvice {

    @ExceptionHandler(NotFoundException)
    handleNotFound(err: NotFoundException, req: SolumjsRequest) {
        req.log?.warn({ path: req.path }, err.message);
        return { status: "error", code: "NOT_FOUND", message: err.message };
    }

    @ExceptionHandler(BadRequestException)
    handleBadRequest(err: BadRequestException, req: SolumjsRequest) {
        return { status: "error", code: "BAD_REQUEST", message: err.message };
    }

    @ExceptionHandler(Error)
    handleGeneric(err: Error, req: SolumjsRequest) {
        req.log?.error({ path: req.path, err }, "Unhandled error");
        return { status: "error", code: "INTERNAL_ERROR", message: "Internal server error" };
    }
}
```

## Security Headers

Applied by `createSecurityMiddlewares()`:

| Header | Value |
|--------|-------|
| content-security-policy | `default-src 'self'; ...` |
| cross-origin-opener-policy | `same-origin` |
| cross-origin-resource-policy | `same-origin` |
| strict-transport-security | `max-age=31536000; includeSubDomains` |
| x-content-type-options | `nosniff` |
| x-frame-options | `SAMEORIGIN` |
| x-xss-protection | `0` |
| referrer-policy | `strict-origin-when-cross-origin` |

## License

MIT
