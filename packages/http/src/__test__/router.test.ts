import { Router } from "../router";

describe("Router", () => {
    let router: Router;

    beforeEach(() => {
        router = new Router();
    });

    it("registers and matches a simple route", () => {
        const handler = jest.fn();
        router.add("get", "/", "/users", handler);
        const match = router.match("GET", "/users");
        expect(match).toBeDefined();
        expect(match!.handler).toBe(handler);
        expect(match!.params).toEqual({});
    });

    it("matches route with path parameters", () => {
        const handler = jest.fn();
        router.add("get", "/", "/users/:id", handler);
        const match = router.match("GET", "/users/123");
        expect(match).toBeDefined();
        expect(match!.params).toEqual({ id: "123" });
    });

    it("matches route with multiple path parameters", () => {
        const handler = jest.fn();
        router.add("get", "/", "/users/:userId/posts/:postId", handler);
        const match = router.match("GET", "/users/42/posts/99");
        expect(match).toBeDefined();
        expect(match!.params).toEqual({ userId: "42", postId: "99" });
    });

    it("returns undefined for non-matching route", () => {
        router.add("get", "/", "/users", jest.fn());
        expect(router.match("GET", "/posts")).toBeUndefined();
    });

    it("returns undefined for wrong HTTP method", () => {
        router.add("get", "/", "/users", jest.fn());
        expect(router.match("POST", "/users")).toBeUndefined();
    });

    it("case-insensitive method matching", () => {
        const handler = jest.fn();
        router.add("get", "/", "/users", handler);
        expect(router.match("get", "/users")).toBeDefined();
        expect(router.match("Get", "/users")).toBeDefined();
    });

    it("registers with prefix", () => {
        const handler = jest.fn();
        router.add("get", "/api/v1", "/users", handler);
        const match = router.match("GET", "/api/v1/users");
        expect(match).toBeDefined();
        expect(match!.patternPath).toBe("/api/v1/users");
    });

    it("register() method works via RouteRegistration", () => {
        const handler = jest.fn();
        router.register("/api", { method: "post", path: "/items", handler });
        const match = router.match("POST", "/api/items");
        expect(match).toBeDefined();
        expect(match!.handler).toBe(handler);
    });

    it("multiple routes with different methods", () => {
        const getHandler = jest.fn();
        const postHandler = jest.fn();
        router.add("get", "/", "/users", getHandler);
        router.add("post", "/", "/users", postHandler);

        expect(router.match("GET", "/users")!.handler).toBe(getHandler);
        expect(router.match("POST", "/users")!.handler).toBe(postHandler);
    });

    it("returns patternPath in match result", () => {
        router.add("get", "/", "/users/:id", jest.fn());
        const match = router.match("GET", "/users/5");
        expect(match!.patternPath).toBe("/users/:id");
    });

    it("handles trailing slashes", () => {
        const handler = jest.fn();
        router.add("get", "/", "/users", handler);
        const match = router.match("GET", "/users/");
        expect(match).toBeDefined();
    });

    it("handles root path", () => {
        const handler = jest.fn();
        router.add("get", "/", "/", handler);
        const match = router.match("GET", "/");
        expect(match).toBeDefined();
    });

    it("first matching route wins", () => {
        const first = jest.fn();
        const second = jest.fn();
        router.add("get", "/", "/users/:id", first);
        router.add("get", "/", "/users/:id", second);
        const match = router.match("GET", "/users/1");
        expect(match!.handler).toBe(first);
    });
});
