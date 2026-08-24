# @solumjs/middlewares

Middleware collection for SolumJS.

## Installation

```bash
npm install @solumjs/middlewares
```

## Features

- Request logger
- Security headers
- Rate limiting
- CSRF protection
- CORS middleware
- Global exception handler
- Not found handler

## Usage

```typescript
import {
    createRequestLogger,
    createSecurityMiddleware,
    createRateLimit,
    csrfProtection,
    globalExceptionHandler,
} from "@solumjs/middlewares";

app.use(createRequestLogger());
app.use(createSecurityMiddleware());
app.use(createRateLimit({ windowMs: 15 * 60 * 1000, max: 100 }));
app.use(csrfProtection());
app.use(globalExceptionHandler());
```
