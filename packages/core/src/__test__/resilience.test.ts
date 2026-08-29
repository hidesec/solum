import "../reflect-metadata";
import {
    CircuitBreaker,
    CircuitState,
    getCircuitBreaker,
    withRetry,
    withCircuitBreaker,
    Retry,
    CircuitBreakerDec,
} from "../resilience";

describe("CircuitBreaker", () => {
    it("starts in CLOSED state", () => {
        const cb = new CircuitBreaker({ failureThreshold: 3, resetTimeoutMs: 1000 });
        expect(cb.getState()).toBe(CircuitState.CLOSED);
        expect(cb.canExecute()).toBe(true);
    });

    it("opens after failure threshold", () => {
        const cb = new CircuitBreaker({ failureThreshold: 3, resetTimeoutMs: 1000 });
        cb.recordFailure();
        cb.recordFailure();
        expect(cb.getState()).toBe(CircuitState.CLOSED);
        cb.recordFailure();
        expect(cb.getState()).toBe(CircuitState.OPEN);
        expect(cb.canExecute()).toBe(false);
    });

    it("transitions to HALF_OPEN after reset timeout", async () => {
        const cb = new CircuitBreaker({ failureThreshold: 2, resetTimeoutMs: 50 });
        cb.recordFailure();
        cb.recordFailure();
        expect(cb.getState()).toBe(CircuitState.OPEN);
        await new Promise((r) => setTimeout(r, 60));
        expect(cb.getState()).toBe(CircuitState.HALF_OPEN);
        expect(cb.canExecute()).toBe(true);
    });

    it("closes from HALF_OPEN on success", async () => {
        const cb = new CircuitBreaker({ failureThreshold: 2, resetTimeoutMs: 50 });
        cb.recordFailure();
        cb.recordFailure();
        await new Promise((r) => setTimeout(r, 60));
        expect(cb.getState()).toBe(CircuitState.HALF_OPEN);
        cb.recordSuccess();
        expect(cb.getState()).toBe(CircuitState.CLOSED);
    });

    it("re-opens from HALF_OPEN on failure", async () => {
        const cb = new CircuitBreaker({ failureThreshold: 2, resetTimeoutMs: 50 });
        cb.recordFailure();
        cb.recordFailure();
        await new Promise((r) => setTimeout(r, 60));
        cb.recordFailure();
        expect(cb.getState()).toBe(CircuitState.OPEN);
    });

    it("respects halfOpenMaxCalls", async () => {
        const cb = new CircuitBreaker({ failureThreshold: 2, resetTimeoutMs: 50, halfOpenMaxCalls: 2 });
        cb.recordFailure();
        cb.recordFailure();
        await new Promise((r) => setTimeout(r, 60));
        expect(cb.canExecute()).toBe(true);
        expect(cb.canExecute()).toBe(true);
        expect(cb.canExecute()).toBe(false);
    });

    it("reset returns to CLOSED", () => {
        const cb = new CircuitBreaker({ failureThreshold: 2, resetTimeoutMs: 1000 });
        cb.recordFailure();
        cb.recordFailure();
        expect(cb.getState()).toBe(CircuitState.OPEN);
        cb.reset();
        expect(cb.getState()).toBe(CircuitState.CLOSED);
        expect(cb.canExecute()).toBe(true);
    });

    it("success in CLOSED state does not change state", () => {
        const cb = new CircuitBreaker({ failureThreshold: 3, resetTimeoutMs: 1000 });
        cb.recordSuccess();
        expect(cb.getState()).toBe(CircuitState.CLOSED);
    });
});

describe("getCircuitBreaker", () => {
    it("returns same instance for same name", () => {
        const a = getCircuitBreaker("my-breaker", { failureThreshold: 5, resetTimeoutMs: 10000 });
        const b = getCircuitBreaker("my-breaker");
        expect(a).toBe(b);
    });

    it("returns different instances for different names", () => {
        const a = getCircuitBreaker("breaker-a");
        const b = getCircuitBreaker("breaker-b");
        expect(a).not.toBe(b);
    });
});

describe("withRetry", () => {
    it("succeeds on first attempt", async () => {
        const result = await withRetry(async () => 42, { maxAttempts: 3, backoffMs: 1 });
        expect(result).toBe(42);
    });

    it("retries on failure and eventually succeeds", async () => {
        let attempts = 0;
        const result = await withRetry(
            async () => {
                attempts++;
                if (attempts < 3) throw new Error("fail");
                return "ok";
            },
            { maxAttempts: 3, backoffMs: 1 }
        );
        expect(result).toBe("ok");
        expect(attempts).toBe(3);
    });

    it("throws after all attempts exhausted", async () => {
        await expect(
            withRetry(async () => { throw new Error("always"); }, { maxAttempts: 2, backoffMs: 1 })
        ).rejects.toThrow("always");
    });

    it("stops retrying when retryOn returns false", async () => {
        const err = new Error("no-retry");
        await expect(
            withRetry(async () => { throw err; }, { maxAttempts: 3, backoffMs: 1, retryOn: () => false })
        ).rejects.toThrow("no-retry");
    });
});

describe("withCircuitBreaker", () => {
    it("executes function normally", async () => {
        const result = await withCircuitBreaker("test-cb", async () => "hello", { failureThreshold: 3, resetTimeoutMs: 1000 });
        expect(result).toBe("hello");
    });

    it("opens circuit after failures", async () => {
        const name = "fail-cb";
        await expect(
            withCircuitBreaker(name, async () => { throw new Error("boom"); }, { failureThreshold: 2, resetTimeoutMs: 10000 })
        ).rejects.toThrow("boom");
        await expect(
            withCircuitBreaker(name, async () => { throw new Error("boom"); }, { failureThreshold: 2, resetTimeoutMs: 10000 })
        ).rejects.toThrow("boom");
        await expect(
            withCircuitBreaker(name, async () => "ok", { failureThreshold: 2, resetTimeoutMs: 10000 })
        ).rejects.toThrow('Circuit breaker "fail-cb" is OPEN');
    });

    it("resets on success from HALF_OPEN", async () => {
        const name = "reset-cb";
        const opts = { failureThreshold: 2, resetTimeoutMs: 50 };
        await withCircuitBreaker(name, async () => { throw new Error("boom"); }, opts).catch(() => {});
        await withCircuitBreaker(name, async () => { throw new Error("boom"); }, opts).catch(() => {});
        await new Promise((r) => setTimeout(r, 60));
        const result = await withCircuitBreaker(name, async () => "recovered", opts);
        expect(result).toBe("recovered");
    });
});

describe("Retry decorator", () => {
    it("stores retry metadata on class", () => {
        class TestClass {
            @Retry({ maxAttempts: 5 })
            doWork() {}
        }
        const metadata = Reflect.getOwnMetadata("custom:retry", TestClass);
        expect(metadata).toBeDefined();
        expect(metadata).toHaveLength(1);
        expect(metadata[0].methodName).toBe("doWork");
        expect(metadata[0].options.maxAttempts).toBe(5);
    });
});

describe("CircuitBreakerDec decorator", () => {
    it("stores circuit breaker metadata on class", () => {
        class TestClass {
            @CircuitBreakerDec({ failureThreshold: 10 })
            callExternal() {}
        }
        const metadata = Reflect.getOwnMetadata("custom:circuit-breaker", TestClass);
        expect(metadata).toBeDefined();
        expect(metadata).toHaveLength(1);
        expect(metadata[0].methodName).toBe("callExternal");
        expect(metadata[0].options.failureThreshold).toBe(10);
    });
});
