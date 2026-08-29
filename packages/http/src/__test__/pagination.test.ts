import {
    PageRequest,
    buildPage,
    parseSort,
    parsePageable,
} from "../pagination";
import { normalizePath } from "../normalize";

describe("parseSort", () => {
    it("parses single sort field", () => {
        expect(parseSort("name,ASC")).toEqual([{ column: "name", direction: "ASC" }]);
    });

    it("parses multiple sort fields", () => {
        expect(parseSort("name,ASC;age,DESC")).toEqual([
            { column: "name", direction: "ASC" },
            { column: "age", direction: "DESC" },
        ]);
    });

    it("defaults to ASC when no direction", () => {
        expect(parseSort("name")).toEqual([{ column: "name", direction: "ASC" }]);
    });

    it("returns empty array for empty string", () => {
        expect(parseSort("")).toEqual([]);
    });

    it("returns empty array for non-string", () => {
        expect(parseSort(undefined as any)).toEqual([]);
    });

    it("filters invalid column names", () => {
        expect(parseSort("name DROP TABLE,ASC")).toEqual([]);
    });
});

describe("parsePageable", () => {
    it("parses page and size from query", () => {
        const result = parsePageable({ page: "2", size: "20" });
        expect(result.page).toBe(2);
        expect(result.size).toBe(20);
    });

    it("clamps page to minimum 1", () => {
        expect(parsePageable({ page: "0" }).page).toBe(1);
        expect(parsePageable({ page: "-5" }).page).toBe(1);
    });

    it("clamps size between 1 and 100", () => {
        expect(parsePageable({ size: "0" }).size).toBe(1);
        expect(parsePageable({ size: "500" }).size).toBe(100);
    });

    it("uses default size when not provided", () => {
        expect(parsePageable({}).size).toBe(20);
    });

    it("respects custom defaultSize", () => {
        expect(parsePageable({}, 25).size).toBe(25);
    });

    it("parses sort from query", () => {
        const result = parsePageable({ sort: "name,ASC" });
        expect(result.sorts).toEqual([{ column: "name", direction: "ASC" }]);
    });

    it("returns default page request for empty query", () => {
        const result = parsePageable({});
        expect(result.page).toBe(1);
        expect(result.size).toBe(20);
        expect(result.sorts).toEqual([]);
    });
});

describe("PageRequest", () => {
    it("computes offset correctly", () => {
        const req = PageRequest.of(3, 10, []);
        expect(req.offset).toBe(20);
    });

    it("clamps page to minimum 1", () => {
        expect(PageRequest.of(0, 10, []).page).toBe(1);
    });

    it("clamps size to minimum 1", () => {
        expect(PageRequest.of(1, 0, []).size).toBe(1);
    });

    it("clamps size to maximum 100", () => {
        expect(PageRequest.of(1, 200, []).size).toBe(100);
    });

    it("defaults to page 1, size 20", () => {
        const req = PageRequest.of();
        expect(req.page).toBe(1);
        expect(req.size).toBe(20);
    });
});

describe("buildPage", () => {
    it("builds page response", () => {
        const req = PageRequest.of(1, 10, []);
        const result = buildPage([1, 2, 3], req, 50);
        expect(result.content).toEqual([1, 2, 3]);
        expect(result.totalElements).toBe(50);
        expect(result.page).toBe(1);
        expect(result.size).toBe(10);
        expect(result.totalPages).toBe(5);
    });

    it("computes totalPages correctly", () => {
        const req = PageRequest.of(1, 10, []);
        const result = buildPage([], req, 25);
        expect(result.totalPages).toBe(3);
    });

    it("marks first and last page", () => {
        const first = buildPage([], PageRequest.of(1, 10, []), 25);
        expect(first.first).toBe(true);
        expect(first.last).toBe(false);

        const last = buildPage([], PageRequest.of(3, 10, []), 25);
        expect(last.first).toBe(false);
        expect(last.last).toBe(true);
    });
});

describe("normalizePath", () => {
    it("removes trailing slash", () => {
        expect(normalizePath("/api/users/")).toBe("/api/users");
    });

    it("collapses duplicate slashes", () => {
        expect(normalizePath("/api//users///1")).toBe("/api/users/1");
    });

    it("preserves root path", () => {
        expect(normalizePath("/")).toBe("/");
    });

    it("handles empty string", () => {
        expect(normalizePath("")).toBe("/");
    });
});
