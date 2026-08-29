import { parseYaml, mergeYaml, flattenYaml, resolvePlaceholders } from "../yaml-parser";

describe("parseYaml", () => {
    it("parses simple key-value pairs", () => {
        const result = parseYaml("name: test\nport: 3000");
        expect(result).toEqual({ name: "test", port: 3000 });
    });

    it("parses boolean values", () => {
        const result = parseYaml("enabled: true\ndisabled: false");
        expect(result.enabled).toBe(true);
        expect(result.disabled).toBe(false);
    });

    it("parses null values", () => {
        const result = parseYaml("value: null\nempty:");
        expect(result.value).toBeNull();
    });

    it("parses nested objects", () => {
        const result = parseYaml("server:\n  host: localhost\n  port: 8080");
        expect(result.server).toEqual({ host: "localhost", port: 8080 });
    });

    it("parses inline arrays", () => {
        const result = parseYaml("items: [a, b, c]");
        expect(result.items).toEqual(["a", "b", "c"]);
    });

    it("parses quoted strings", () => {
        const result = parseYaml('name: "hello world"');
        expect(result.name).toBe("hello world");
    });

    it("ignores comments", () => {
        const result = parseYaml("# comment\nname: test");
        expect(result).toEqual({ name: "test" });
    });

    it("parses numeric values", () => {
        const result = parseYaml("count: 42\nprice: 9.99\nnegative: -5");
        expect(result.count).toBe(42);
        expect(result.price).toBe(9.99);
        expect(result.negative).toBe(-5);
    });
});

describe("mergeYaml", () => {
    it("merges two objects", () => {
        const base = { a: 1, b: 2 };
        const override = { b: 3, c: 4 };
        const result = mergeYaml(base, override);
        expect(result).toEqual({ a: 1, b: 3, c: 4 });
    });

    it("blocks __proto__ key (prototype pollution prevention)", () => {
        const base = { safe: true };
        const malicious = { __proto__: { polluted: true } };
        const result = mergeYaml(base, malicious);

        expect(result).toEqual({ safe: true });
        expect(({} as any).polluted).toBeUndefined();
    });

    it("blocks constructor key", () => {
        const base = { safe: true };
        const malicious = { constructor: { polluted: true } };
        const result = mergeYaml(base, malicious);

        expect(result).toEqual({ safe: true });
    });

    it("blocks prototype key", () => {
        const base = { safe: true };
        const malicious = { prototype: { polluted: true } };
        const result = mergeYaml(base, malicious);

        expect(result).toEqual({ safe: true });
    });

    it("deep merges nested objects", () => {
        const base = { server: { host: "localhost", port: 3000 } };
        const override = { server: { port: 8080 } };
        const result = mergeYaml(base, override);

        expect(result).toEqual({ server: { host: "localhost", port: 8080 } });
    });

    it("overrides non-object values", () => {
        const base = { name: "old" };
        const override = { name: "new" };
        const result = mergeYaml(base, override);

        expect(result.name).toBe("new");
    });
});

describe("flattenYaml", () => {
    it("flattens nested objects", () => {
        const doc = { server: { host: "localhost", port: 3000 } };
        const result = flattenYaml(doc);

        expect(result).toEqual({
            "server.host": "localhost",
            "server.port": "3000",
        });
    });

    it("converts arrays to JSON strings", () => {
        const doc = { items: [1, 2, 3] };
        const result = flattenYaml(doc);

        expect(result.items).toBe("[1,2,3]");
    });

    it("handles flat objects", () => {
        const doc = { a: "1", b: "2" };
        const result = flattenYaml(doc);

        expect(result).toEqual({ a: "1", b: "2" });
    });

    it("skips null values", () => {
        const doc = { a: "1", b: null };
        const result = flattenYaml(doc);

        expect(result).toEqual({ a: "1" });
    });
});

describe("resolvePlaceholders", () => {
    it("replaces ${VAR} with env values", () => {
        const doc = { url: "http://${HOST}:${PORT}" };
        const env = { HOST: "localhost", PORT: "3000" };
        const result = resolvePlaceholders(doc, env);

        expect(result.url).toBe("http://localhost:3000");
    });

    it("uses default values when env is missing", () => {
        const doc = { url: "http://${HOST:localhost}:${PORT:8080}" };
        const result = resolvePlaceholders(doc, {});

        expect(result.url).toBe("http://localhost:8080");
    });

    it("preserves placeholders when env is missing and no default", () => {
        const doc = { url: "http://${MISSING}" };
        const result = resolvePlaceholders(doc, {});

        expect(result.url).toBe("http://${MISSING}");
    });

    it("resolves nested placeholders", () => {
        const doc = { server: { url: "http://${HOST}" } };
        const env = { HOST: "example.com" };
        const result = resolvePlaceholders(doc, env);

        expect((result.server as any).url).toBe("http://example.com");
    });
});
