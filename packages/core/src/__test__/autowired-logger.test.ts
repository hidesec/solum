import { container } from "../container";
import { AutoWired } from "../autowired.decorator";
import { getFrameworkLogger, setFrameworkLogger, LoggerPort } from "../framework-logger";

describe("AutoWired", () => {
    afterEach(() => container.clear());

    it("resolves dependency from container", () => {
        const instance = { value: "real" };
        container.register("TestService", { useValue: instance });

        class Consumer {
            @AutoWired("TestService")
            declare service: any;
        }

        const consumer = new Consumer();
        expect(consumer.service).toBeDefined();
        expect(consumer.service.value).toBe("real");
    });

    it("caches resolved value on same instance (singleton behavior)", () => {
        const instance = { id: Math.random() };
        container.register("CachedService", { useValue: instance });

        class Consumer {
            @AutoWired("CachedService")
            declare service: any;
        }

        const consumer = new Consumer();
        const first = consumer.service;
        const second = consumer.service;
        expect(first).toBe(second);
        expect(first.id).toBe(instance.id);
    });

    it("allows manual override via setter", () => {
        container.register("OverrideService", { useValue: { value: "real" } });

        class Consumer {
            @AutoWired("OverrideService")
            declare service: any;
        }

        const consumer = new Consumer();
        const manual = { value: "manual" };
        consumer.service = manual;
        expect(consumer.service.value).toBe("manual");
    });

    it("different instances get same resolved value for useValue", () => {
        const instance = { id: 42 };
        container.register("InstService", { useValue: instance });

        class Consumer {
            @AutoWired("InstService")
            declare service: any;
        }

        const a = new Consumer();
        const b = new Consumer();
        expect(a.service).toBe(b.service);
        expect(a.service.id).toBe(42);
    });

    it("throws when token not registered", () => {
        class Consumer {
            @AutoWired("NonExistent")
            declare service: any;
        }

        const consumer = new Consumer();
        expect(() => consumer.service).toThrow();
    });
});

describe("getFrameworkLogger and setFrameworkLogger", () => {
    it("getFrameworkLogger returns a logger with standard methods", () => {
        const logger = getFrameworkLogger();
        expect(logger).toBeDefined();
        expect(typeof logger.info).toBe("function");
        expect(typeof logger.warn).toBe("function");
        expect(typeof logger.error).toBe("function");
        expect(typeof logger.debug).toBe("function");
        expect(typeof logger.child).toBe("function");
    });

    it("setFrameworkLogger replaces the current logger", () => {
        const original = getFrameworkLogger();
        const mockLogger: LoggerPort = {
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
            debug: jest.fn(),
            child: jest.fn().mockReturnThis(),
        };

        setFrameworkLogger(mockLogger);
        const current = getFrameworkLogger();
        expect(current).toBe(mockLogger);

        setFrameworkLogger(original);
    });

    it("child logger merges bindings", () => {
        const logger = getFrameworkLogger();
        const child = logger.child({ requestId: "123" });
        expect(child).toBeDefined();
        expect(typeof child.info).toBe("function");
    });

    it("ConsoleLogger handles string-only messages", () => {
        const logger = getFrameworkLogger();
        expect(() => logger.info("test message")).not.toThrow();
        expect(() => logger.warn("test warning")).not.toThrow();
        expect(() => logger.error("test error")).not.toThrow();
        expect(() => logger.debug("test debug")).not.toThrow();
    });

    it("ConsoleLogger handles object + message", () => {
        const logger = getFrameworkLogger();
        expect(() => logger.info({ key: "value" }, "with context")).not.toThrow();
        expect(() => logger.warn({ key: "value" }, "with context")).not.toThrow();
        expect(() => logger.error({ err: new Error("test") }, "with error")).not.toThrow();
    });
});
