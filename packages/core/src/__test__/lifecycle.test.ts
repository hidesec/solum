import "../reflect-metadata";
import {
    PostConstruct,
    PreDestroy,
    registerLifecycleHooks,
    registerDestroyHook,
    runPreDestroyHooks,
} from "../lifecycle.decorator";

describe("PostConstruct decorator", () => {
    it("stores metadata on class", () => {
        class TestClass {
            @PostConstruct()
            init() {}
        }
        const meta = Reflect.getOwnMetadata("custom:post-construct", TestClass);
        expect(meta).toContain("init");
    });

    it("supports multiple methods", () => {
        class TestClass {
            @PostConstruct()
            initA() {}
            @PostConstruct()
            initB() {}
        }
        const meta = Reflect.getOwnMetadata("custom:post-construct", TestClass);
        expect(meta).toEqual(["initA", "initB"]);
    });
});

describe("PreDestroy decorator", () => {
    it("stores metadata on class", () => {
        class TestClass {
            @PreDestroy()
            cleanup() {}
        }
        const meta = Reflect.getOwnMetadata("custom:pre-destroy", TestClass);
        expect(meta).toContain("cleanup");
    });
});

describe("registerDestroyHook and runPreDestroyHooks", () => {
    it("registerDestroyHook adds entry", async () => {
        const destroyFn = jest.fn();
        registerDestroyHook("test-hook", destroyFn);
        await runPreDestroyHooks();
        expect(destroyFn).toHaveBeenCalled();
    });

    it("runPreDestroyHooks handles errors gracefully", async () => {
        registerDestroyHook("failing-hook", () => { throw new Error("destroy failed"); });
        await expect(runPreDestroyHooks()).resolves.toBeUndefined();
    });
});

describe("registerLifecycleHooks", () => {
    it("registers PostConstruct hooks that fire on resolution", async () => {
        const { container } = await import("../container");
        class TestService {
            initialized = false;
            @PostConstruct()
            init() { this.initialized = true; }
        }

        registerLifecycleHooks("TestLifecycleService", TestService);
        container.register("TestLifecycleService", { useClass: TestService });
        const instance = container.resolve("TestLifecycleService") as any;
        expect(instance.initialized).toBe(true);
        container.clear();
    });
});
