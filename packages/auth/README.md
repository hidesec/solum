# @solumjs/auth

Authentication and authorization module for SolumJS.

## Installation

```bash
npm install @solumjs/auth
```

## Features

- JWT authentication
- Password hashing (bcrypt)
- Role-based access control
- Guard decorators
- Token refresh

## Usage

```typescript
import { AuthModule, JwtAuthGuard, Roles } from "@solumjs/auth";

app.use(AuthModule.configure({
    secret: process.env.JWT_SECRET,
    expiresIn: "1h",
}));

@JwtAuthGuard()
@Roles("admin")
class AdminController {
    // Protected routes
}
```
