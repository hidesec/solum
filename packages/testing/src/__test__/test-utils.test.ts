describe("testing package: SetActiveProfiles", () => {
    const originalEnv = process.env.SOLUM_PROFILE;

    afterEach(() => {
        if (originalEnv !== undefined) {
            process.env.SOLUM_PROFILE = originalEnv;
        } else {
            delete process.env.SOLUM_PROFILE;
        }
    });

    it("sets profile names and env var", async () => {
        const { SetActiveProfiles, GetActiveProfiles, ClearActiveProfiles } = await import("../test-utils");
        SetActiveProfiles("dev", "local");
        expect(GetActiveProfiles()).toEqual(["dev", "local"]);
        expect(process.env.SOLUM_PROFILE).toBe("dev");
        ClearActiveProfiles();
    });

    it("GetActiveProfiles returns empty array initially", async () => {
        const { GetActiveProfiles, ClearActiveProfiles } = await import("../test-utils");
        ClearActiveProfiles();
        expect(GetActiveProfiles()).toEqual([]);
    });

    it("ClearActiveProfiles resets state", async () => {
        const { SetActiveProfiles, ClearActiveProfiles, GetActiveProfiles } = await import("../test-utils");
        SetActiveProfiles("prod");
        expect(GetActiveProfiles()).toEqual(["prod"]);
        ClearActiveProfiles();
        expect(GetActiveProfiles()).toEqual([]);
        expect(process.env.SOLUM_PROFILE).toBeUndefined();
    });
});

describe("testing package: MockBean decorator", () => {
    it("MockBean registers metadata on class", async () => {
        const { MockBean, getMockBeans } = await import("../test-utils");
        class TestClass {
            @MockBean("IUserService")
            declare userService: any;
        }
        const declarations = getMockBeans(TestClass);
        expect(declarations).toHaveLength(1);
        expect(declarations[0].token).toBe("IUserService");
        expect(declarations[0].propertyKey).toBe("userService");
    });

    it("getMockBeans returns empty array for class without MockBean", async () => {
        const { getMockBeans } = await import("../test-utils");
        class PlainClass {}
        expect(getMockBeans(PlainClass)).toEqual([]);
    });
});

describe("testing package: applyMockBeans", () => {
    it("creates placeholder for unregistered mock bean", async () => {
        const { MockBean, applyMockBeans, clearMockBeans } = await import("../test-utils");
        clearMockBeans();

        class TestClass {
            @MockBean("IMissing")
            declare missing: any;
        }

        const instance = new TestClass();
        applyMockBeans(instance);
        expect(instance.missing).toBeDefined();
        expect(instance.missing[Symbol.toPrimitive]()).toContain("MockBean");
        clearMockBeans();
    });

    it("returns same placeholder for same token across instances", async () => {
        const { MockBean, applyMockBeans, clearMockBeans } = await import("../test-utils");
        clearMockBeans();

        class TestClass {
            @MockBean("IShared")
            declare shared: any;
        }

        const a = new TestClass();
        const b = new TestClass();
        applyMockBeans(a);
        applyMockBeans(b);
        expect(a.shared).toBe(b.shared);
        clearMockBeans();
    });
});

describe("testing package: setupMockBeans", () => {
    it("creates placeholder mocks for class declarations", async () => {
        const { MockBean, setupMockBeans, clearMockBeans, getMockBeans } = await import("../test-utils");
        clearMockBeans();

        class TestClass {
            @MockBean("IA")
            declare a: any;
        }

        setupMockBeans([TestClass]);
        const declarations = getMockBeans(TestClass);
        expect(declarations).toHaveLength(1);
        clearMockBeans();
    });
});

describe("testing package: createMockDriver", () => {
    it("creates a mock driver with default methods", async () => {
        const { createMockDriver } = await import("../test-utils");
        const driver = createMockDriver();
        expect(driver.clientName).toBe("sqlite");
        expect(typeof driver.query).toBe("function");
        expect(typeof driver.connect).toBe("function");
        expect(typeof driver.close).toBe("function");
        expect(typeof driver.transaction).toBe("function");
    });

    it("allows overrides", async () => {
        const { createMockDriver } = await import("../test-utils");
        const driver = createMockDriver({ clientName: "mysql" as any });
        expect(driver.clientName).toBe("mysql");
    });
});

describe("testing package: mockBean", () => {
    it("registers mock in container", async () => {
        const { mockBean, resetContainer } = await import("../test-utils");
        resetContainer();
        mockBean("ITest", { hello: "world" });
        resetContainer();
    });
});

describe("testing package: resetContainer", () => {
    it("clears container and mock beans", async () => {
        const { resetContainer, mockBean } = await import("../test-utils");
        resetContainer();
        mockBean("ITest2", { val: 1 });
        resetContainer();
    });
});

describe("testing package: MockLogger", () => {
    it("has spy methods", async () => {
        const { MockLogger } = await import("../test-utils");
        const logger = new MockLogger();
        logger.info("test");
        logger.warn("warn");
        logger.error("err");
        logger.debug("dbg");
        logger.child("child");
        expect(logger.info).toHaveBeenCalled();
        expect(logger.warn).toHaveBeenCalled();
        expect(logger.error).toHaveBeenCalled();
        expect(logger.debug).toHaveBeenCalled();
        expect(logger.child).toHaveBeenCalled();
    });
});
