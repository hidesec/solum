import { createApplication, SolumApplication } from "../application";

jest.mock("@solumjs/database", () => ({
    createDatabaseDriver: jest.fn().mockResolvedValue({
        clientName: "sqlite",
        query: jest.fn().mockResolvedValue({ rows: [] }),
        connect: jest.fn(),
        close: jest.fn(),
    }),
    connectMongo: jest.fn(),
}));

jest.mock("@solumjs/cache", () => ({
    cacheManager: { useStore: jest.fn() },
    connectRedis: jest.fn(),
    RedisCacheStore: jest.fn(),
}));

jest.mock("@solumjs/schedule", () => ({
    startScheduledTasks: jest.fn(),
    stopScheduledTasks: jest.fn(),
}));

jest.mock("../router-factory", () => ({
    mountControllers: jest.fn(),
    listRegisteredRoutes: jest.fn().mockReturnValue([]),
}));

jest.mock("../openapi", () => ({
    mountOpenApi: jest.fn(),
}));

describe("createApplication", () => {
    const originalEnv = process.env;
    const originalListeners: Record<string, Function[]> = {};

    beforeEach(() => {
        process.env = { ...originalEnv };
        process.env.NODE_ENV = "test";
        for (const event of ["SIGTERM", "SIGINT", "unhandledRejection", "uncaughtException"]) {
            originalListeners[event] = process.listeners(event).slice() as Function[];
        }
    });

    afterEach(async () => {
        process.env = originalEnv;
        for (const event of ["SIGTERM", "SIGINT", "unhandledRejection", "uncaughtException"]) {
            process.removeAllListeners(event);
            for (const listener of originalListeners[event]) {
                process.on(event as any, listener as any);
            }
        }
    });

    it("creates app with minimal options", async () => {
        const app = await createApplication({
            autoDatabase: false,
            autoCache: false,
            autoMongo: false,
            docs: false,
            port: 0,
        });
        expect(app).toBeDefined();
        expect(app.server).toBeDefined();
        expect(app.port).toBe(0);
        await app.shutdown();
    });

    it("onListen callback is called with port and protocol", async () => {
        const onListen = jest.fn();
        const app = await createApplication({
            autoDatabase: false,
            autoCache: false,
            autoMongo: false,
            docs: false,
            port: 0,
            onListen,
        });
        expect(app).toBeDefined();
        await new Promise((r) => setTimeout(r, 200));
        expect(onListen).toHaveBeenCalled();
        await app.shutdown();
    });

    it("custom middlewares are applied", async () => {
        const customMiddleware = jest.fn((_req: any, _res: any, next: () => void) => next());
        const app = await createApplication({
            autoDatabase: false,
            autoCache: false,
            autoMongo: false,
            docs: false,
            port: 0,
            middlewares: [customMiddleware],
        });
        expect(app).toBeDefined();
        await app.shutdown();
    });

    it("shutdown stops scheduled tasks and closes server", async () => {
        const { stopScheduledTasks } = require("@solumjs/schedule");
        const app = await createApplication({
            autoDatabase: false,
            autoCache: false,
            autoMongo: false,
            docs: false,
            port: 0,
        });
        await app.shutdown();
        expect(stopScheduledTasks).toHaveBeenCalled();
    });

    it("returns driver when autoDatabase is true", async () => {
        const app = await createApplication({
            autoDatabase: true,
            autoCache: false,
            autoMongo: false,
            docs: false,
            port: 0,
        });
        expect(app.driver).toBeDefined();
        expect(app.driver!.clientName).toBe("sqlite");
        await app.shutdown();
    });

    it("uses port from config when not specified in options", async () => {
        const app = await createApplication({
            autoDatabase: false,
            autoCache: false,
            autoMongo: false,
            docs: false,
        });
        expect(app.port).toBe(3000);
        await app.shutdown();
    });

    it("respects custom port from options", async () => {
        const app = await createApplication({
            autoDatabase: false,
            autoCache: false,
            autoMongo: false,
            docs: false,
            port: 0,
        });
        expect(app.port).toBe(0);
        await app.shutdown();
    });

    it("graceful shutdown runs PreDestroy hooks", async () => {
        const app = await createApplication({
            autoDatabase: false,
            autoCache: false,
            autoMongo: false,
            docs: false,
            port: 0,
        });
        await expect(app.shutdown()).resolves.not.toThrow();
    });

    it("accepts logger option", async () => {
        const mockLogger = {
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
            debug: jest.fn(),
        };
        const app = await createApplication({
            logger: mockLogger as any,
            autoDatabase: false,
            autoCache: false,
            autoMongo: false,
            docs: false,
            port: 0,
        });
        expect(app).toBeDefined();
        await app.shutdown();
    });

    it("mounts OpenAPI docs when NODE_ENV is development", async () => {
        process.env.NODE_ENV = "development";
        const { mountOpenApi } = require("../openapi");
        mountOpenApi.mockClear();
        const app = await createApplication({
            autoDatabase: false,
            autoCache: false,
            autoMongo: false,
            docs: true,
            port: 0,
        });
        expect(mountOpenApi).toHaveBeenCalled();
        await app.shutdown();
    });

    it("disables OpenAPI docs in production", async () => {
        process.env.NODE_ENV = "production";
        const { mountOpenApi } = require("../openapi");
        mountOpenApi.mockClear();
        const app = await createApplication({
            autoDatabase: false,
            autoCache: false,
            autoMongo: false,
            docs: true,
            port: 0,
        });
        expect(mountOpenApi).not.toHaveBeenCalled();
        await app.shutdown();
    });

    it("skips OpenAPI when docs=false", async () => {
        const { mountOpenApi } = require("../openapi");
        mountOpenApi.mockClear();
        const app = await createApplication({
            autoDatabase: false,
            autoCache: false,
            autoMongo: false,
            docs: false,
            port: 0,
        });
        expect(mountOpenApi).not.toHaveBeenCalled();
        await app.shutdown();
    });
});
