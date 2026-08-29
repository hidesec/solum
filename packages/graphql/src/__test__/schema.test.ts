import { SchemaBuilder, createSchema } from "../schema";

describe("SchemaBuilder", () => {
    it("creates a schema builder", () => {
        const builder = new SchemaBuilder();
        expect(builder).toBeInstanceOf(SchemaBuilder);
    });

    it("creates via createSchema factory", () => {
        const builder = createSchema();
        expect(builder).toBeInstanceOf(SchemaBuilder);
    });

    it("initializes with typeDefs", () => {
        const builder = new SchemaBuilder({ typeDefs: "type Query { hello: String }" });
        const result = builder.build();
        expect(result.typeDefs).toBe("type Query { hello: String }");
    });

    it("initializes with resolvers", () => {
        const resolvers = { Query: { hello: () => "world" } };
        const builder = new SchemaBuilder({ resolvers });
        const result = builder.build();
        expect(result.resolvers.Query.hello()).toBe("world");
    });

    it("type() adds type definition", () => {
        const builder = new SchemaBuilder();
        builder.type("User", "{ name: String, age: Int }");
        const result = builder.build();
        expect(result.typeDefs).toContain("type User");
        expect(result.typeDefs).toContain("name: String");
    });

    it("input() adds input definition", () => {
        const builder = new SchemaBuilder();
        builder.input("CreateUser", "{ name: String! }");
        const result = builder.build();
        expect(result.typeDefs).toContain("input CreateUser");
    });

    it("enum() adds enum definition", () => {
        const builder = new SchemaBuilder();
        builder.enum("Status", ["ACTIVE", "INACTIVE"]);
        const result = builder.build();
        expect(result.typeDefs).toContain("enum Status");
        expect(result.typeDefs).toContain("ACTIVE INACTIVE");
    });

    it("query() adds query definition", () => {
        const builder = new SchemaBuilder();
        builder.query("{ user: User, users: [User] }");
        const result = builder.build();
        expect(result.typeDefs).toContain("type Query");
        expect(result.typeDefs).toContain("user: User");
    });

    it("mutation() adds mutation definition", () => {
        const builder = new SchemaBuilder();
        builder.mutation("{ createUser: User }");
        const result = builder.build();
        expect(result.typeDefs).toContain("type Mutation");
    });

    it("subscription() adds subscription definition", () => {
        const builder = new SchemaBuilder();
        builder.subscription("{ onUserCreated: User }");
        const result = builder.build();
        expect(result.typeDefs).toContain("type Subscription");
    });

    it("resolver() registers resolver function", () => {
        const handler = (_parent: any, args: any) => args.id;
        const builder = new SchemaBuilder();
        builder.resolver("Query", "user", handler);
        const result = builder.build();
        expect(result.resolvers.Query.user).toBe(handler);
    });

    it("resolver() creates parent type if missing", () => {
        const builder = new SchemaBuilder();
        builder.resolver("Mutation", "create", () => "ok");
        const result = builder.build();
        expect(result.resolvers.Mutation.create()).toBe("ok");
    });

    it("build() returns combined typeDefs", () => {
        const builder = new SchemaBuilder();
        builder.type("User", "{ id: ID, name: String }");
        builder.query("{ users: [User] }");
        builder.mutation("{ createUser(name: String): User }");
        const result = builder.build();
        expect(result.typeDefs).toContain("type User");
        expect(result.typeDefs).toContain("type Query");
        expect(result.typeDefs).toContain("type Mutation");
    });

    it("chaining works", () => {
        const result = new SchemaBuilder()
            .type("User", "{ id: ID }")
            .input("UserInput", "{ name: String }")
            .enum("Role", ["ADMIN", "USER"])
            .query("{ me: User }")
            .mutation("{ updateUser(input: UserInput): User }")
            .subscription("{ userUpdated: User }")
            .resolver("Query", "me", () => ({ id: "1" }))
            .build();

        expect(result.typeDefs).toContain("type User");
        expect(result.typeDefs).toContain("input UserInput");
        expect(result.typeDefs).toContain("enum Role");
        expect(result.typeDefs).toContain("type Query");
        expect(result.typeDefs).toContain("type Mutation");
        expect(result.typeDefs).toContain("type Subscription");
    });

    it("merges multiple resolvers for same parent type", () => {
        const builder = new SchemaBuilder();
        builder.resolver("Query", "user", () => "user");
        builder.resolver("Query", "items", () => "items");
        const result = builder.build();
        expect(result.resolvers.Query.user()).toBe("user");
        expect(result.resolvers.Query.items()).toBe("items");
    });

    it("build() returns empty string when no typeDefs", () => {
        const builder = new SchemaBuilder();
        const result = builder.build();
        expect(result.typeDefs).toBe("");
        expect(result.resolvers).toEqual({});
    });
});
