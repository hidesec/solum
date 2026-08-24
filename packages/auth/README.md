# @solumjs/auth

JWT authentication, guards, role-based access, `@PreAuthorize`, password hashing, and OAuth2.

## Install

```bash
npm install @solumjs/auth
```

## JWT Service

```typescript
import { JwtService, TokenClaims } from "@solumjs/auth";

const jwtService = new JwtService({ secret: "your-secret", expiresIn: 3600 });

const claims: TokenClaims = { sub: user.id, email: user.email, role: user.role };

// Generate tokens
const accessToken = jwtService.signAccessToken(claims);
const refreshToken = jwtService.signRefreshToken(claims);

// Verify token
const payload = jwtService.verify(accessToken);

// Revoke token
jwtService.revoke(accessToken);
```

## JwtAuthGuard

```typescript
import { JwtAuthGuard } from "@solumjs/auth";
import { RestController, Get, UseGuards, CurrentUser } from "@solumjs/http";

@RestController("/users")
@UseGuards(JwtAuthGuard)
export class UserController {

    @Get("/me")
    async getProfile(@CurrentUser() user: JwtPayload) {
        return this.userService.findById(user.sub);
    }
}
```

## RolesGuard and @Roles

```typescript
import { JwtAuthGuard, RolesGuard, Roles } from "@solumjs/auth";
import { RestController, Get, UseGuards } from "@solumjs/http";

@RestController("/admin")
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminController {

    @Get("/dashboard")
    @Roles("ADMIN")
    async dashboard() { return "admin data"; }

    @Get("/users")
    @Roles("ADMIN", "MODERATOR")
    async listUsers() { return []; }
}
```

## @PreAuthorize

```typescript
import { PreAuthorize } from "@solumjs/auth";
import { RestController, Get, Param } from "@solumjs/http";

@RestController("/documents")
export class DocumentController {

    @Get("/:id")
    @PreAuthorize("hasRole('ADMIN') or #id == authentication.sub")
    async getDocument(@Param("id") id: string) {
        return this.documentService.findById(id);
    }
}
```

## Password Hashing

```typescript
import { hashPassword, verifyPassword } from "@solumjs/auth";

// Hash password (scrypt with random salt)
const hashed = hashPassword("my-password");

// Verify password
const isValid = verifyPassword("my-password", hashed);
```

## OAuth2

```typescript
import { OAuth2Client } from "@solumjs/auth";

const googleClient = new OAuth2Client({
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    redirectUri: "http://localhost:3000/auth/google/callback",
    authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenEndpoint: "https://oauth2.googleapis.com/token",
    scopes: ["openid", "email", "profile"],
});

// Generate authorization URL
const authUrl = googleClient.getAuthorizationUrl();

// Exchange code for tokens
const tokens = await googleClient.exchangeCode(code);

// Get user info
const userInfo = await googleClient.getUserInfo(tokens.accessToken);
```

## Refresh Token Store

```typescript
import { InMemoryRefreshTokenStore, RefreshTokenStore } from "@solumjs/auth";

const store = new InMemoryRefreshTokenStore();

// Store refresh token
await store.save(userId, refreshToken);

// Validate refresh token
const valid = await store.validate(refreshToken);

// Revoke refresh token
await store.revoke(refreshToken);
```

## JWT Features

- HS256 signing algorithm
- Token revocation support
- Minimum 32-character secret requirement
- Expiration and nbf validation
- Issuer and audience validation
- Timing-safe signature comparison

## License

MIT
