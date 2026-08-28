import { container } from "@solumjs/core";
import { getResolvers, GraphQLResolver } from "./decorators";

export interface SchemaBuilderOptions {
    typeDefs?: string;
    resolvers?: Record<string, any>;
}

export class SchemaBuilder {
    private typeDefs: string[] = [];
    private resolvers: Record<string, any> = {};
    private registeredTypes = new Set<string>();

    constructor(options: SchemaBuilderOptions = {}) {
        if (options.typeDefs) {
            this.typeDefs.push(options.typeDefs);
        }
        if (options.resolvers) {
            Object.assign(this.resolvers, options.resolvers);
        }
    }

    type(name: string, definition: string): this {
        this.typeDefs.push(`type ${name} ${definition}`);
        this.registeredTypes.add(name);
        return this;
    }

    input(name: string, definition: string): this {
        this.typeDefs.push(`input ${name} ${definition}`);
        this.registeredTypes.add(name);
        return this;
    }

    enum(name: string, values: string[]): this {
        const enumDef = `enum ${name} { ${values.join(" ")} }`;
        this.typeDefs.push(enumDef);
        this.registeredTypes.add(name);
        return this;
    }

    query(definition: string): this {
        this.typeDefs.push(`type Query ${definition}`);
        return this;
    }

    mutation(definition: string): this {
        this.typeDefs.push(`type Mutation ${definition}`);
        return this;
    }

    subscription(definition: string): this {
        this.typeDefs.push(`type Subscription ${definition}`);
        return this;
    }

    resolver(typeName: string, fieldName: string, handler: (parent: any, args: any, context: any) => any): this {
        if (!this.resolvers[typeName]) {
            this.resolvers[typeName] = {};
        }
        this.resolvers[typeName][fieldName] = handler;
        return this;
    }

    build(): { typeDefs: string; resolvers: Record<string, any> } {
        return {
            typeDefs: this.typeDefs.join("\n"),
            resolvers: this.resolvers,
        };
    }
}

export function createSchema(options: SchemaBuilderOptions = {}): SchemaBuilder {
    return new SchemaBuilder(options);
}

function parseTypeDefs(typeDefs: string): { Query: Record<string, any>; Mutation: Record<string, any>; Subscription: Record<string, any>; Types: Record<string, any> } {
    const parsed: { Query: Record<string, any>; Mutation: Record<string, any>; Subscription: Record<string, any>; Types: Record<string, any> } = {
        Query: {},
        Mutation: {},
        Subscription: {},
        Types: {},
    };

    const typeRegex = /type\s+(\w+)\s*\{([^}]+)\}/g;
    const inputRegex = /input\s+(\w+)\s*\{([^}]+)\}/g;
    const enumRegex = /enum\s+(\w+)\s*\{([^}]+)\}/g;

    let match;

    while ((match = typeRegex.exec(typeDefs)) !== null) {
        const [, typeName, body] = match;
        if (typeName === "Query" || typeName === "Mutation" || typeName === "Subscription") {
            const fields = body.trim().split("\n").map((line) => {
                const trimmed = line.trim();
                if (!trimmed || trimmed.startsWith("#")) return null;
                const fieldMatch = trimmed.match(/^(\w+)\s*(?:\([^)]*\))?\s*:\s*(.+)/);
                if (!fieldMatch) return null;
                const [, fieldName, fieldType] = fieldMatch;
                return { name: fieldName, type: fieldType.replace(/[!\[\]]/g, "").trim() };
            }).filter(Boolean);

            for (const field of fields) {
                if (field) {
                    parsed[typeName as keyof typeof parsed][field.name] = { type: field.type };
                }
            }
        } else {
            parsed.Types[typeName] = { fields: body };
        }
    }

    while ((match = inputRegex.exec(typeDefs)) !== null) {
        const [, typeName, body] = match;
        parsed.Types[typeName] = { fields: body, isInput: true };
    }

    while ((match = enumRegex.exec(typeDefs)) !== null) {
        const [, typeName, body] = match;
        parsed.Types[typeName] = { values: body.trim().split(/\s+/), isEnum: true };
    }

    return parsed;
}

function buildSchemaFromResolvers(resolvers: GraphQLResolver[]): { typeDefs: string; resolvers: Record<string, any> } {
    const queryFields: string[] = [];
    const mutationFields: string[] = [];
    const subscriptionFields: string[] = [];
    const resolverMap: Record<string, any> = {};

    for (const resolver of resolvers) {
        const instance = container.resolve(resolver.target);
        const handler = instance[resolver.fieldName];

        if (!resolverMap[resolver.parentType]) {
            resolverMap[resolver.parentType] = {};
        }

        resolverMap[resolver.parentType][resolver.fieldName] = handler;

        const fieldDef = `${resolver.fieldName}: String`;
        if (resolver.parentType === "Query") {
            queryFields.push(fieldDef);
        } else if (resolver.parentType === "Mutation") {
            mutationFields.push(fieldDef);
        } else if (resolver.parentType === "Subscription") {
            subscriptionFields.push(fieldDef);
        }
    }

    const typeDefs: string[] = [];
    if (queryFields.length > 0) {
        typeDefs.push(`type Query { ${queryFields.join("\n  ")} }`);
    }
    if (mutationFields.length > 0) {
        typeDefs.push(`type Mutation { ${mutationFields.join("\n  ")} }`);
    }
    if (subscriptionFields.length > 0) {
        typeDefs.push(`type Subscription { ${subscriptionFields.join("\n  ")} }`);
    }

    return {
        typeDefs: typeDefs.join("\n"),
        resolvers: resolverMap,
    };
}
