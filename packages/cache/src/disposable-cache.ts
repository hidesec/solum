import { CacheManager } from "./cache.decorator";

/**
 * Disposable cache entry that auto-evicts when going out of scope.
 *
 * @example
 * ```ts
 * {
 *     using entry = new DisposableCacheEntry(cacheManager, "user:123", userData, 300);
 *     // entry.value is userData, cached with key "user:123"
 *     // automatically evicted when leaving this block
 * }
 * ```
 */
export class DisposableCacheEntry<T> implements Disposable {
    private evicted = false;

    constructor(
        private readonly manager: CacheManager,
        private readonly key: string,
        public readonly value: T,
        private readonly ttlSeconds: number
    ) {
        manager.set(key, value, ttlSeconds);
    }

    [Symbol.dispose](): void {
        if (!this.evicted) {
            this.evicted = true;
            this.manager.evict(this.key);
        }
    }
}

/**
 * Async disposable cache entry that auto-evicts when going out of scope.
 *
 * @example
 * ```ts
 * await using entry = new AsyncDisposableCacheEntry(cacheManager, "session:abc", sessionData, 600);
 * // entry.value is sessionData, cached with key "session:abc"
 * // automatically evicted when leaving this async block
 * ```
 */
export class AsyncDisposableCacheEntry<T> implements AsyncDisposable {
    private evicted = false;

    constructor(
        private readonly manager: CacheManager,
        private readonly key: string,
        public readonly value: T,
        private readonly ttlSeconds: number
    ) {
        manager.set(key, value, ttlSeconds);
    }

    async [Symbol.asyncDispose](): Promise<void> {
        if (!this.evicted) {
            this.evicted = true;
            await this.manager.evict(this.key);
        }
    }
}
