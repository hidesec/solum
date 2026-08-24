# @solumjs/cache

Caching module with decorator-based cache management for SolumJS.

## Installation

```bash
npm install @solumjs/cache
```

## Features

- In-memory cache store
- Cache decorators (`@Cacheable`, `@CacheEvict`, `@CachePut`)
- Key expressions with `{param}` syntax
- TTL support

## Usage

```typescript
import { Cacheable, CacheEvict, CacheManager } from "@solumjs/cache";

class UserService {
    @Cacheable({ key: "user:{id}", ttlSeconds: 300 })
    async findById(id: string) {
        return await db.users.findById(id);
    }

    @CacheEvict({ key: "user:{id}" })
    async update(id: string, data: Partial<User>) {
        return await db.users.update(id, data);
    }
}
```
