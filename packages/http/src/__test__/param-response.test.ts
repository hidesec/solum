import {
    getParamsMetadata,
} from "../param.decorator";
import {
    getResponseStatus,
    ResponseStatus,
} from "../response.decorator";

describe("getParamsMetadata", () => {
    it("returns empty array for method without decorators", () => {
        class TestClass {
            doStuff(_a: string, _b: number) {}
        }
        expect(getParamsMetadata(TestClass, "doStuff")).toEqual([]);
    });
});

describe("getResponseStatus", () => {
    it("returns fallback when no decorator", () => {
        class TestClass {
            doStuff() {}
        }
        expect(getResponseStatus(TestClass, "doStuff", 200)).toBe(200);
    });

    it("returns decorated status code", () => {
        class TestClass {
            @ResponseStatus(201)
            create() {}
        }
        expect(getResponseStatus(TestClass, "create", 200)).toBe(201);
    });

    it("returns 200 default fallback when no decorator and no fallback arg", () => {
        class TestClass {
            doStuff() {}
        }
        expect(getResponseStatus(TestClass, "doStuff")).toBe(200);
    });

    it("supports 204 No Content", () => {
        class TestClass {
            @ResponseStatus(204)
            remove() {}
        }
        expect(getResponseStatus(TestClass, "remove", 200)).toBe(204);
    });
});
