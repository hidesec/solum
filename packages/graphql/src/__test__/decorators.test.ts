import "reflect-metadata";
import {
    Query,
    Mutation,
    Subscription,
    GraphQLType,
    GraphQLField,
    getResolvers,
    getRegisteredResolvers,
} from "../decorators";

describe("GraphQL decorators", () => {
    describe("@Query", () => {
        it("registers query resolver metadata", () => {
            class UserResolver {
                @Query("user")
                getUser() {}
            }

            const resolvers = getResolvers(UserResolver);
            expect(resolvers).toHaveLength(1);
            expect(resolvers[0].fieldName).toBe("user");
            expect(resolvers[0].parentType).toBe("Query");
        });

        it("registers multiple query resolvers", () => {
            class MultiResolver {
                @Query("user")
                getUser() {}

                @Query("items")
                getItems() {}
            }

            const resolvers = getResolvers(MultiResolver);
            expect(resolvers).toHaveLength(2);
        });
    });

    describe("@Mutation", () => {
        it("registers mutation resolver metadata", () => {
            class UserResolver {
                @Mutation("createUser")
                create() {}
            }

            const resolvers = getResolvers(UserResolver);
            expect(resolvers).toHaveLength(1);
            expect(resolvers[0].fieldName).toBe("createUser");
            expect(resolvers[0].parentType).toBe("Mutation");
        });
    });

    describe("@Subscription", () => {
        it("registers subscription resolver metadata", () => {
            class UserResolver {
                @Subscription("onUserCreated")
                onCreated() {}
            }

            const resolvers = getResolvers(UserResolver);
            expect(resolvers).toHaveLength(1);
            expect(resolvers[0].fieldName).toBe("onUserCreated");
            expect(resolvers[0].parentType).toBe("Subscription");
        });
    });

    describe("@GraphQLType", () => {
        it("registers type name on class", () => {
            @GraphQLType("User")
            class UserType {}

            const types = Reflect.getMetadata("custom:graphql:types", UserType);
            expect(types).toBeDefined();
            expect(types).toContain("User");
        });
    });

    describe("@GraphQLField", () => {
        it("registers field metadata", () => {
            @GraphQLType("User")
            class UserType {
                @GraphQLField("name", "String")
                name: string = "";
            }

            const fields = Reflect.getMetadata("custom:graphql:types", UserType);
            expect(fields).toBeDefined();
            expect(fields.length).toBeGreaterThanOrEqual(1);
        });
    });

    describe("getResolvers", () => {
        it("returns empty array for class with no resolvers", () => {
            class Empty {}
            const resolvers = getResolvers(Empty);
            expect(resolvers).toEqual([]);
        });

        it("returns all resolver metadata for a class", () => {
            class CombinedResolver {
                @Query("hello")
                hello() {}

                @Mutation("update")
                update() {}

                @Subscription("onUpdate")
                onUpdate() {}
            }

            const resolvers = getResolvers(CombinedResolver);
            expect(resolvers).toHaveLength(3);
            const types = resolvers.map((r) => r.parentType);
            expect(types).toContain("Query");
            expect(types).toContain("Mutation");
            expect(types).toContain("Subscription");
        });
    });

    describe("getRegisteredResolvers", () => {
        it("returns an array", () => {
            const result = getRegisteredResolvers();
            expect(Array.isArray(result)).toBe(true);
        });

        it("returns empty when no resolvers registered via design:paramtypes", () => {
            const result = getRegisteredResolvers();
            expect(result.length).toBe(0);
        });
    });
});
