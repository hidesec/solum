# @solumjs/cache

Caching with decorator-based cache management. InMemory and Redis cache stores.

## Install

```bash
npm install @solumjs/cache
```

## Cache Decorators

```typescript
import { Cacheable, CacheEvict, CachePut, CacheManager } from "@solumjs/cache";
import { Bean } from "@solumjs/core";

@Bean("IProductService")
export class ProductService {

    @Cacheable("products", 300, "{id}")
    async findById(id: string): Promise<Product> {
        // Only executed if not in cache
        return this.productRepo.findById(id);
    }

    @CachePut("products", 300, "{id}")
    async update(id: string, dto: UpdateProductDto): Promise<Product> {
        // Always executes and updates cache
        return this.productRepo.update(id, dto);
    }

    @CacheEvict("products")
    async delete(id: string): Promise<void> {
        await this.productRepo.delete(id);
    }
}
```

### Decorator Signatures

```typescript
Cacheable(cacheName: string, ttlSeconds?: number, keyExpression?: string)
CachePut(cacheName: string, ttlSeconds?: number, keyExpression?: string)
CacheEvict(cacheName: string)
```

## Cache Key Expression

```typescript
// Named params resolved from method arguments
@Cacheable("users", 60, "{id}")
async findById(id: string) { /* ... */ }

// Positional syntax
@Cacheable("orders", 60, "{0}:item:{1}")
async getOrderItem(orderId: string, itemId: string) { /* ... */ }
```

## CacheManager

```typescript
import { cacheManager } from "@solumjs/cache";

// Get from cache
const value = await cacheManager.get("key");

// Set cache
await cacheManager.set("key", value, 60);

// Evict by prefix
await cacheManager.evict("users");

// Sweep expired entries
const removed = await cacheManager.sweep();

// Clear all
await cacheManager.clear();
```

## InMemoryCacheStore

```typescript
import { InMemoryCacheStore } from "@solumjs/cache";

// Default: 10000 entries
const store = new InMemoryCacheStore();

// Custom max entries
const store = new InMemoryCacheStore(5000);
```

## RedisCacheStore

```typescript
import { RedisCacheStore, connectRedis } from "@solumjs/cache";

const client = await connectRedis("redis://localhost:6379");
const store = new RedisCacheStore(client);

// Set as default store
cacheManager.useStore(store);
```

## resolveCacheKey

```typescript
import { resolveCacheKey } from "@solumjs/cache";

const key = resolveCacheKey("{id}", ["123"]);
// "123"

const key = resolveCacheKey("{0}:item:{1}", ["order-1", "item-2"]);
// "order-1:item-2"
```

## License

MIT
