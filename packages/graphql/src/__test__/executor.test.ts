import { executeGraphQL } from "../executor";

describe("GraphQL executor", () => {
    it("executes a simple query", () => {
        const resolvers = {
            Query: {
                hello: () => "world",
            },
        };
        const result = executeGraphQL("{ hello }", resolvers);
        expect(result.data).toEqual({ hello: "world" });
    });

    it("executes query with arguments", () => {
        const resolvers = {
            Query: {
                user: (_: any, args: { id: string }) => ({ id: args.id, name: "John" }),
            },
        };
        const result = executeGraphQL('{ user(id: "1") { id name } }', resolvers);
        expect(result.data).toEqual({
            user: { id: "1", name: "John" },
        });
    });

    it("executes mutation", () => {
        const resolvers = {
            Mutation: {
                createUser: (_: any, args: { name: string }) => ({ id: "1", name: args.name }),
            },
        };
        const result = executeGraphQL('{ createUser(name: "Alice") { id name } }', resolvers);
        expect(result.data).toEqual({
            createUser: { id: "1", name: "Alice" },
        });
    });

    it("returns null for missing resolver", () => {
        const resolvers = { Query: {} };
        const result = executeGraphQL("{ hello }", resolvers);
        expect(result.data).toEqual({ hello: null });
    });

    it("handles aliases", () => {
        const resolvers = {
            Query: {
                user: () => ({ name: "John" }),
            },
        };
        const result = executeGraphQL("{ myUser: user { name } }", resolvers);
        expect(result.data).toEqual({
            myUser: { name: "John" },
        });
    });

    it("handles nested selections on array results", () => {
        const resolvers = {
            Query: {
                users: () => [
                    { id: "1", name: "John" },
                    { id: "2", name: "Jane" },
                ],
            },
        };
        const result = executeGraphQL("{ users { id name } }", resolvers);
        expect(result.data).toEqual({
            users: [
                { id: "1", name: "John" },
                { id: "2", name: "Jane" },
            ],
        });
    });

    it("parses string arguments", () => {
        const resolvers = {
            Query: {
                greet: (_: any, args: { name: string }) => `Hello ${args.name}`,
            },
        };
        const result = executeGraphQL('{ greet(name: "World") }', resolvers);
        expect(result.data).toEqual({ greet: "Hello World" });
    });

    it("parses numeric arguments", () => {
        const resolvers = {
            Query: {
                add: (_: any, args: { a: number; b: number }) => args.a + args.b,
            },
        };
        const result = executeGraphQL("{ add(a: 2, b: 3) }", resolvers);
        expect(result.data).toEqual({ add: 5 });
    });

    it("parses boolean arguments", () => {
        const resolvers = {
            Query: {
                isActive: (_: any, args: { flag: boolean }) => args.flag,
            },
        };
        const result = executeGraphQL("{ isActive(flag: true) }", resolvers);
        expect(result.data).toEqual({ isActive: true });
    });

    it("rejects queries exceeding max depth", () => {
        const deepQuery = "{ a { b { c { d { e { f { g { h { i { j { k } } } } } } } } } } }";
        const resolvers = {
            Query: {
                a: () => ({ b: () => ({ c: () => ({}) }) }),
            },
        };
        const result = executeGraphQL(deepQuery, resolvers);
        expect(result.errors).toBeDefined();
        expect(result.errors![0].extensions.code).toBe("EXECUTION_ERROR");
    });

    it("allows queries within depth limit", () => {
        const shallowQuery = "{ user { name } }";
        const resolvers = {
            Query: {
                user: () => ({ name: "John" }),
            },
        };
        const result = executeGraphQL(shallowQuery, resolvers);
        expect(result.data).toEqual({ user: { name: "John" } });
    });

    it("handles single-line deeply nested query (depth bypass fix)", () => {
        const deepSingleLine = "{a{b{c{d{e{f{g{h{i{j{k{l}}}}}}}}}}}}";
        const resolvers = { Query: { a: () => ({}) } };
        const result = executeGraphQL(deepSingleLine, resolvers);
        expect(result.errors).toBeDefined();
    });

    it("handles empty query gracefully", () => {
        const result = executeGraphQL("", {});
        expect(result.errors).toBeDefined();
    });

    it("passes variables to context", () => {
        const resolvers = {
            Query: {
                echo: (_: any, _args: any, context: any) => context.variables,
            },
        };
        const result = executeGraphQL("{ echo }", resolvers, { msg: "hello" });
        expect(result.data).toEqual({ echo: { msg: "hello" } });
    });
});
