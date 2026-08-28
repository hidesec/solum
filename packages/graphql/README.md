# @solumjs/graphql

GraphQL support for SolumJS framework.

## Features

- Schema builder with type definitions
- `@Query`, `@Mutation`, `@Subscription` decorators
- `@GraphQLType` and `@GraphQLField` decorators
- Built-in GraphiQL playground
- Query execution engine

## Installation

```bash
npm install @solumjs/graphql
```

## Usage

### Schema Builder

```typescript
import { createSchema, mountGraphQL } from "@solumjs/graphql";

const schema = createSchema()
  .type("User", `{ id: ID!, name: String!, email: String! }`)
  .type("Post", `{ id: ID!, title: String!, author: User! }`)
  .input("CreateUserInput", `{ name: String!, email: String! }`)
  .query(`
    users: [User!]!
    user(id: ID!): User
  `)
  .mutation(`
    createUser(input: CreateUserInput!): User!
    deleteUser(id: ID!): Boolean!
  `)
  .resolver("Query", "users", () => {
    return [{ id: "1", name: "John", email: "john@example.com" }];
  })
  .resolver("Query", "user", (_, { id }) => {
    return { id, name: "John", email: "john@example.com" };
  })
  .resolver("Mutation", "createUser", (_, { input }) => {
    return { id: "1", ...input };
  });

// Mount in your application
mountGraphQL(adapter, schema);
```

### Decorators

```typescript
import { GrpcService, GrpcMethod, Query, Mutation } from "@solumjs/graphql";

@GrpcService("UserService")
class UserService {
  @Query("users")
  async getUsers() {
    return [{ id: "1", name: "John" }];
  }

  @Mutation("createUser")
  async createUser(@Args() input: CreateUserInput) {
    return { id: "1", ...input };
  }
}
```

### HTTP Handler

```typescript
import { mountGraphQL } from "@solumjs/graphql";

mountGraphQL(adapter, schema, {
  path: "/graphql",
  graphiql: true,  // Enable GraphiQL playground
});
```

## API Reference

### SchemaBuilder

- `type(name, definition)` - Define a GraphQL type
- `input(name, definition)` - Define a GraphQL input type
- `enum(name, values)` - Define a GraphQL enum
- `query(definition)` - Define query fields
- `mutation(definition)` - Define mutation fields
- `subscription(definition)` - Define subscription fields
- `resolver(typeName, fieldName, handler)` - Register a field resolver
- `build()` - Build the schema

### Decorators

- `@Query(fieldName)` - Mark a method as a query resolver
- `@Mutation(fieldName)` - Mark a method as a mutation resolver
- `@Subscription(fieldName)` - Mark a method as a subscription resolver
- `@GraphQLType(typeName)` - Mark a class as a GraphQL type
- `@GraphQLField(fieldName, type)` - Mark a method as a GraphQL field

## License

MIT
