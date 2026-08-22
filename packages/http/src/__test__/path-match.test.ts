import { matchPathPattern } from "../path-match";

describe("path pattern matching", () => {
    it("matches exact paths", () => {
        expect(matchPathPattern("/users", "/users")).toBe(true);
        expect(matchPathPattern("/users", "/users/1")).toBe(false);
    });

    it("matches named params", () => {
        expect(matchPathPattern("/users/:id/posts/:postId", "/users/42/posts/7")).toBe(true);
        expect(matchPathPattern("/users/:id", "/users")).toBe(false);
    });

    it("single star matches exactly one segment", () => {
        expect(matchPathPattern("/api/*", "/api/v1")).toBe(true);
        expect(matchPathPattern("/api/*", "/api/v1/deep")).toBe(false);
    });

    it("double star matches multi-segment suffixes", () => {
        expect(matchPathPattern("/api/**", "/api/v1/deep/path")).toBe(true);
        expect(matchPathPattern("/**", "/anything/at/all")).toBe(true);
        expect(matchPathPattern("/api/**", "/other")).toBe(false);
    });

    it("supports inline wildcards inside segments", () => {
        expect(matchPathPattern("/files/*.pdf", "/files/report.pdf")).toBe(true);
        expect(matchPathPattern("/admin/*/report", "/admin/x/y/report")).toBe(false);
    });

    it("normalizes trailing slashes", () => {
        expect(matchPathPattern("/users/", "/users")).toBe(true);
        expect(matchPathPattern("/users", "/users/")).toBe(true);
    });
});
