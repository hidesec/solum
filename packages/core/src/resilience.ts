import { getFrameworkLogger } from "./framework-logger";

export interface RetryOptions {
    maxAttempts: number;
    backoffMs?: number;
    backoffMultiplier?: number;
    maxBackoffMs?: number;
    retryOn?: (error: unknown) => boolean;
}

export interface CircuitBreakerOptions {
    failureThreshold: number;
    resetTimeoutMs: number;
    halfOpenMaxCalls?: number;
}

export enum CircuitState {
    CLOSED = "CLOSED",
    OPEN = "OPEN",
    HALF_OPEN = "HALF_OPEN",
}

export class CircuitBreaker {
    private state: CircuitState = CircuitState.CLOSED;
    private failureCount = 0;

    private lastFailureTime = 0;
    private halfOpenCalls = 0;

    constructor(private readonly options: CircuitBreakerOptions) {}

    getState(): CircuitState {
        if (this.state === CircuitState.OPEN) {
            if (Date.now() - this.lastFailureTime >= this.options.resetTimeoutMs) {
                this.state = CircuitState.HALF_OPEN;
                this.halfOpenCalls = 0;
            }
        }
        return this.state;
    }

    canExecute(): boolean {
        const state = this.getState();
        if (state === CircuitState.CLOSED) return true;
        if (state === CircuitState.HALF_OPEN) {
            const max = this.options.halfOpenMaxCalls ?? 1;
            if (this.halfOpenCalls < max) {
                this.halfOpenCalls++;
                return true;
            }
            return false;
        }
        return false;
    }

    recordSuccess(): void {
        if (this.state === CircuitState.HALF_OPEN) {
            this.state = CircuitState.CLOSED;
            this.failureCount = 0;

        } else {

        }
    }

    recordFailure(): void {
        this.failureCount++;
        this.lastFailureTime = Date.now();

        if (this.state === CircuitState.HALF_OPEN) {
            this.state = CircuitState.OPEN;
        } else if (this.failureCount >= this.options.failureThreshold) {
            this.state = CircuitState.OPEN;
        }
    }

    reset(): void {
        this.state = CircuitState.CLOSED;
        this.failureCount = 0;
    }
}

const circuitBreakers = new Map<string, CircuitBreaker>();

export function getCircuitBreaker(name: string, options?: CircuitBreakerOptions): CircuitBreaker {
    if (!circuitBreakers.has(name)) {
        circuitBreakers.set(name, new CircuitBreaker(options ?? { failureThreshold: 5, resetTimeoutMs: 30000 }));
    }
    return circuitBreakers.get(name)!;
}

export async function withRetry<T>(fn: () => Promise<T>, options: RetryOptions): Promise<T> {
    let lastError: unknown;
    const maxAttempts = options.maxAttempts || 3;
    const backoffMs = options.backoffMs ?? 100;
    const backoffMultiplier = options.backoffMultiplier ?? 2;
    const maxBackoffMs = options.maxBackoffMs ?? 30000;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;

            if (options.retryOn && !options.retryOn(error)) {
                throw error;
            }

            if (attempt < maxAttempts) {
                const delay = Math.min(backoffMs * Math.pow(backoffMultiplier, attempt - 1), maxBackoffMs);
                getFrameworkLogger().debug({ attempt, maxAttempts, delay }, "Retry attempt");
                await new Promise((resolve) => setTimeout(resolve, delay));
            }
        }
    }

    throw lastError;
}

export async function withCircuitBreaker<T>(
    name: string,
    fn: () => Promise<T>,
    options?: CircuitBreakerOptions
): Promise<T> {
    const breaker = getCircuitBreaker(name, options);

    if (!breaker.canExecute()) {
        throw new Error(`Circuit breaker "${name}" is OPEN`);
    }

    try {
        const result = await fn();
        breaker.recordSuccess();
        return result;
    } catch (error) {
        breaker.recordFailure();
        throw error;
    }
}

const RETRY_METADATA = "custom:retry";
const CIRCUIT_BREAKER_METADATA = "custom:circuit-breaker";

export function Retry(options: Partial<RetryOptions> = {}): MethodDecorator {
    return function (target: any, propertyKey: string | symbol, _descriptor?: PropertyDescriptor) {
        const existing: { methodName: string; options: Partial<RetryOptions> }[] =
            Reflect.getOwnMetadata(RETRY_METADATA, target.constructor ?? target) || [];
        existing.push({ methodName: propertyKey as string, options });
        Reflect.defineMetadata(RETRY_METADATA, existing, target.constructor ?? target);
    };
}

export function CircuitBreakerDec(options: Partial<CircuitBreakerOptions> = {}): MethodDecorator {
    return function (target: any, propertyKey: string | symbol, _descriptor?: PropertyDescriptor) {
        const existing: { methodName: string; options: Partial<CircuitBreakerOptions> }[] =
            Reflect.getOwnMetadata(CIRCUIT_BREAKER_METADATA, target.constructor ?? target) || [];
        existing.push({ methodName: propertyKey as string, options });
        Reflect.defineMetadata(CIRCUIT_BREAKER_METADATA, existing, target.constructor ?? target);
    };
}
