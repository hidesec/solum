import { UseInterceptors, getControllerInterceptors, getHandlerInterceptors, addInterceptors, resetInterceptors, resolveInterceptors } from "../interceptor";

class MockInterceptor {
    preHandle = jest.fn().mockReturnValue(true);
}

describe("UseInterceptors decorator", () => {
    it("stores class-level interceptors", () => {
        @UseInterceptors(MockInterceptor)
        class TestClass {}
        expect(Reflect.getOwnMetadata("custom:controller-interceptors", TestClass)).toContain(MockInterceptor);
    });

    it("stores handler-level interceptors", () => {
        class TestClass {
            @UseInterceptors(MockInterceptor)
            doStuff() {}
        }
        const meta = Reflect.getOwnMetadata("custom:use-interceptors", TestClass);
        expect(meta).toBeDefined();
    });
});

describe("getControllerInterceptors", () => {
    it("returns empty array for class without interceptors", () => {
        class Plain {}
        expect(getControllerInterceptors(Plain)).toEqual([]);
    });
});

describe("getHandlerInterceptors", () => {
    it("returns empty array for method without interceptors", () => {
        class Plain {
            doStuff() {}
        }
        expect(getHandlerInterceptors(Plain, "doStuff")).toEqual([]);
    });
});

describe("interceptor registry", () => {
    beforeEach(() => resetInterceptors());

    it("addInterceptors and resolveInterceptors", () => {
        const interceptor = new MockInterceptor();
        addInterceptors(interceptor);
        const resolved = resolveInterceptors("GET", "/test");
        expect(resolved).toContain(interceptor);
    });

    it("pattern-filtered interceptors only match matching paths", () => {
        const interceptor = new MockInterceptor();
        addInterceptors(interceptor, { patterns: ["/api/*"] });
        expect(resolveInterceptors("GET", "/api/data")).toContain(interceptor);
        expect(resolveInterceptors("GET", "/other")).not.toContain(interceptor);
    });

    it("method-filtered interceptors only match matching methods", () => {
        const interceptor = new MockInterceptor();
        addInterceptors(interceptor, { methods: ["POST"] });
        expect(resolveInterceptors("POST", "/test")).toContain(interceptor);
        expect(resolveInterceptors("GET", "/test")).not.toContain(interceptor);
    });

    it("excludePatterns exclude matching paths", () => {
        const interceptor = new MockInterceptor();
        addInterceptors(interceptor, { excludePatterns: ["/health"] });
        expect(resolveInterceptors("GET", "/api/data")).toContain(interceptor);
        expect(resolveInterceptors("GET", "/health")).not.toContain(interceptor);
    });
});
