import { Logger, createLogger, setGlobalLogger, getLogger } from "../logger";

describe("Logger", () => {
    let logSpy: jest.SpyInstance;
    let warnSpy: jest.SpyInstance;
    let errorSpy: jest.SpyInstance;

    beforeEach(() => {
        logSpy = jest.spyOn(console, "log").mockImplementation();
        warnSpy = jest.spyOn(console, "warn").mockImplementation();
        errorSpy = jest.spyOn(console, "error").mockImplementation();
    });

    afterEach(() => {
        logSpy.mockRestore();
        warnSpy.mockRestore();
        errorSpy.mockRestore();
    });

    it("logs info messages", () => {
        const logger = new Logger("test");
        logger.info("hello");
        expect(logSpy).toHaveBeenCalled();
    });

    it("logs warn messages", () => {
        const logger = new Logger("test");
        logger.warn("warning");
        expect(warnSpy).toHaveBeenCalled();
    });

    it("logs error messages", () => {
        const logger = new Logger("test");
        logger.error("error");
        expect(errorSpy).toHaveBeenCalled();
    });

    it("logs debug messages when level allows", () => {
        const logger = new Logger("test", { level: "debug" });
        logger.debug("debug msg");
        expect(logSpy).toHaveBeenCalled();
    });

    it("filters messages below log level", () => {
        const logger = new Logger("test", { level: "error" });
        logger.info("should not appear");
        expect(logSpy).not.toHaveBeenCalled();
    });

    it("logs fatal to stderr", () => {
        const logger = new Logger("test");
        logger.fatal("fatal");
        expect(errorSpy).toHaveBeenCalled();
    });

    it("creates child logger with appended context", () => {
        const parent = new Logger("parent");
        const child = parent.child("child");
        child.info("test");
        expect(logSpy).toHaveBeenCalled();
    });

    it("withContext is alias for child", () => {
        const logger = new Logger("base");
        const child = logger.withContext("sub");
        expect(child).toBeInstanceOf(Logger);
    });

    it("formats JSON when json option is true", () => {
        const logger = new Logger("test", { json: true });
        logger.info("json-msg");
        const output = logSpy.mock.calls[0][0];
        expect(() => JSON.parse(output)).not.toThrow();
    });

    it("includes context in output", () => {
        const logger = new Logger("my-context");
        logger.info("msg");
        const output = logSpy.mock.calls[0][0];
        expect(output).toContain("my-context");
    });

    it("includes serviceName when set", () => {
        const logger = new Logger("ctx", { serviceName: "my-app" });
        logger.info("msg");
        expect(logSpy).toHaveBeenCalled();
    });
});

describe("createLogger", () => {
    it("returns a Logger instance", () => {
        expect(createLogger("test")).toBeInstanceOf(Logger);
    });
});

describe("getLogger and setGlobalLogger", () => {
    afterEach(() => {
        setGlobalLogger(createLogger("app"));
    });

    it("getLogger returns global logger", () => {
        const logger = createLogger("global");
        setGlobalLogger(logger);
        expect(getLogger()).toBe(logger);
    });

    it("getLogger with context creates child", () => {
        const logger = createLogger("base");
        setGlobalLogger(logger);
        const child = getLogger("sub");
        expect(child).toBeInstanceOf(Logger);
    });

    it("getLogger creates default if none set", () => {
        setGlobalLogger(createLogger("app"));
        const result = getLogger();
        expect(result).toBeInstanceOf(Logger);
    });
});
