import http from "http";
import { container } from "@solumjs/core";
import { NodeHttpAdapter } from "@solumjs/http";
import { mountControllers } from "@solumjs/config";
import { registerDatabaseDriver } from "@solumjs/orm";

const ACTIVE_PROFILES_KEY = "custom:active-profiles";
let activeProfiles: string[] = [];

export function SetActiveProfiles(...profiles: string[]): void {
    activeProfiles = profiles;
    process.env.SOLUM_PROFILE = profiles[0] || "test";
}

export function GetActiveProfiles(): string[] {
    return activeProfiles;
}

export function ClearActiveProfiles(): void {
    activeProfiles = [];
    delete process.env.SOLUM_PROFILE;
}

const MOCK_BEANS_KEY = "custom:mock-beans";
const mockBeans: Map<string, unknown> = new Map();

export function MockBean(token: string | Function): PropertyDecorator {
    return (target, propertyKey) => {
        const existing: Array<{ token: string | Function; propertyKey: string | symbol }> =
            Reflect.getOwnMetadata(MOCK_BEANS_KEY, target.constructor) || [];
        existing.push({ token, propertyKey });
        Reflect.defineMetadata(MOCK_BEANS_KEY, existing, target.constructor);
    };
}

export function getMockBeans(target: Function): Array<{ token: string | Function; propertyKey: string | symbol }> {
    return Reflect.getOwnMetadata(MOCK_BEANS_KEY, target) || [];
}

export function applyMockBeans(instance: any): void {
    const declarations = getMockBeans(instance.constructor);
    for (const { token, propertyKey } of declarations) {
        const mockValue = mockBeans.get(typeof token === "string" ? token : token.name);
        if (mockValue !== undefined) {
            (instance as any)[propertyKey] = mockValue;
        } else {
            const placeholder = createPlaceholderMock(token);
            mockBeans.set(typeof token === "string" ? token : token.name, placeholder);
            (instance as any)[propertyKey] = placeholder;
        }
    }
}

function createPlaceholderMock(token: string | Function): any {
    const name = typeof token === "string" ? token : token.name;
    return new Proxy(
        {},
        {
            get(_target, prop) {
                if (prop === Symbol.toPrimitive) return () => `[MockBean: ${name}]`;
                if (prop === "then") return undefined;
                return (...args: any[]) => {
                    throw new Error(`MockBean ${name}.${String(prop)} called but not configured. Use mockBean() to set implementation.`);
                };
            },
        }
    );
}

export function setupMockBeans(classes: Function[]): void {
    for (const cls of classes) {
        const declarations = getMockBeans(cls);
        for (const { token, propertyKey } of declarations) {
            const tokenName = typeof token === "string" ? token : token.name;
            if (!mockBeans.has(tokenName)) {
                mockBeans.set(tokenName, createPlaceholderMock(token));
            }
        }
    }
}

export function clearMockBeans(): void {
    mockBeans.clear();
}

export interface TestApplication {
    server: http.Server;
    port: number;
    baseUrl: string;
    close: () => Promise<void>;
    inject: (request: TestRequest) => Promise<TestResponse>;
}

export interface TestRequest {
    method?: string;
    path: string;
    body?: unknown;
    headers?: Record<string, string>;
    query?: Record<string, string>;
}

export interface TestResponse {
    status: number;
    headers: Record<string, string | string[] | undefined>;
    body: unknown;
    text: string;
}

interface MockDriver {
    clientName: string;
    query: jest.Mock;
    connect: jest.Mock;
    close: jest.Mock;
    transaction: jest.Mock;
}

export function createMockDriver(overrides?: Partial<MockDriver>): MockDriver {
    return {
        clientName: "sqlite",
        query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
        connect: jest.fn().mockResolvedValue(undefined),
        close: jest.fn().mockResolvedValue(undefined),
        transaction: jest.fn().mockImplementation(async (fn: Function) => fn({})),
        ...overrides,
    };
}

export function createTestApplication(options?: {
    scanDirs?: string[];
    mockDriver?: boolean;
}): TestApplication {
    const port = 0;
    const adapter = new NodeHttpAdapter({
        bodyLimitBytes: 1024 * 1024,
        notFoundHandler: (_req, res) => {
            res.status(404).json({ error: "Not Found" });
        },
        errorHandler: (err, _req, res) => {
            const statusCode = (err as any).statusCode || 500;
            res.status(statusCode).json({ error: err.message });
        },
    });

    if (options?.mockDriver !== false) {
        const mockDriver = createMockDriver();
        registerDatabaseDriver(mockDriver as any);
    }

    mountControllers(adapter);

    const server = adapter.listen(port) as http.Server;
    const assignedPort = (server.address() as any)?.port || 0;

    return {
        server,
        port: assignedPort,
        baseUrl: `http://localhost:${assignedPort}`,
        close: () =>
            new Promise<void>((resolve) => {
                server.close(() => resolve());
            }),
        inject: async (request: TestRequest): Promise<TestResponse> => {
            return new Promise((resolve, reject) => {
                const url = new URL(request.path, `http://localhost:${assignedPort}`);

                if (request.query) {
                    for (const [key, value] of Object.entries(request.query)) {
                        url.searchParams.set(key, value);
                    }
                }

                const options: http.RequestOptions = {
                    hostname: "localhost",
                    port: assignedPort,
                    path: url.pathname + url.search,
                    method: request.method || "GET",
                    headers: {
                        "content-type": "application/json",
                        ...request.headers,
                    },
                };

                const req = http.request(options, (res) => {
                    const chunks: Buffer[] = [];
                    res.on("data", (chunk) => chunks.push(chunk));
                    res.on("end", () => {
                        const text = Buffer.concat(chunks).toString("utf8");
                        let body: unknown;
                        try {
                            body = JSON.parse(text);
                        } catch {
                            body = text;
                        }

                        resolve({
                            status: res.statusCode || 200,
                            headers: res.headers,
                            body,
                            text,
                        });
                    });
                });

                req.on("error", reject);

                if (request.body) {
                    req.write(JSON.stringify(request.body));
                }

                req.end();
            });
        },
    };
}

export function mockBean<T>(token: string | (new (...args: any[]) => T), implementation: Partial<T>): void {
    container.register(token, { useValue: implementation });
}

export function resetContainer(): void {
    container.clear();
}

export class MockLogger {
    info = jest.fn();
    warn = jest.fn();
    error = jest.fn();
    debug = jest.fn();
    child = jest.fn().mockReturnThis();
}
