# @solumjs/testing

Testing utilities with mock support for SolumJS applications.

## Install

```bash
npm install -D @solumjs/testing
```

## createTestApplication

```typescript
import { createTestApplication } from "@solumjs/testing";

describe("UserController", () => {
    let app: any;

    beforeAll(async () => {
        app = await createTestApplication({
            scanDirs: ["controllers", "services"],
            mockDriver: true, // default: true, uses mock DB driver
        });
    });

    afterAll(async () => {
        await app?.close();
    });

    it("should return health check", async () => {
        const response = await app.inject({
            method: "GET",
            path: "/health",
        });
        expect(response.status).toBe(200);
    });
});
```

## TestApplication Interface

```typescript
interface TestApplication {
    server: http.Server;
    port: number;
    baseUrl: string;
    close: () => Promise<void>;
    inject: (request: TestRequest) => Promise<TestResponse>;
}

interface TestRequest {
    method?: string;     // default: GET
    path: string;
    body?: unknown;
    headers?: Record<string, string>;
    query?: Record<string, string>;
}

interface TestResponse {
    status: number;
    headers: Record<string, string | string[] | undefined>;
    body: unknown;
    text: string;
}
```

## MockBean

```typescript
import { MockBean, mockBean, applyMockBeans } from "@solumjs/testing";

describe("UserService", () => {
    let service: UserService;
    let mockUserRepo: any;

    beforeEach(() => {
        mockUserRepo = {
            findById: jest.fn(),
            save: jest.fn(),
            findByEmail: jest.fn(),
        };
        service = new UserService(mockUserRepo);
    });

    it("should throw NotFoundException for missing user", async () => {
        mockUserRepo.findById.mockResolvedValue(null);
        await expect(service.findById("nonexistent")).rejects.toThrow("not found");
    });
});
```

## mockBean

```typescript
import { mockBean } from "@solumjs/testing";

// Register mock in IoC container
mockBean("IUserService", {
    findById: jest.fn().mockResolvedValue({ id: "1", name: "John" }),
});
```

## MockLogger

```typescript
import { MockLogger } from "@solumjs/testing";

const logger = new MockLogger();
// Provides: info, warn, error, debug, child (all jest.fn())
```

## createMockDriver

```typescript
import { createMockDriver } from "@solumjs/testing";

const mockDriver = createMockDriver({
    clientName: "sqlite",
    query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
});
```

## Profile Management

```typescript
import { SetActiveProfiles, GetActiveProfiles, ClearActiveProfiles } from "@solumjs/testing";

SetActiveProfiles("test");
GetActiveProfiles(); // ["test"]
ClearActiveProfiles();
```

## resetContainer

```typescript
import { resetContainer } from "@solumjs/testing";

afterEach(() => {
    resetContainer(); // Clears all registered beans
});
```

## License

MIT
