const GRAPHQL_RESOLVERS_KEY = "custom:graphql:resolvers";
const GRAPHQL_SCHEMA_KEY = "custom:graphql:schema";
const GRAPHQL_TYPES_KEY = "custom:graphql:types";

export interface GraphQLSchema {
    typeDefs: string;
    resolvers: Record<string, any>;
}

export interface GraphQLResolver {
    target: new (...args: any[]) => any;
    fieldName: string;
    parentType: string;
    args?: Record<string, any>;
}

export function Query(fieldName: string) {
    return function (target: any, propertyKey: string, _descriptor?: PropertyDescriptor) {
        const existing: GraphQLResolver[] = Reflect.getMetadata(GRAPHQL_RESOLVERS_KEY, target.constructor) || [];
        existing.push({
            target: target.constructor,
            fieldName,
            parentType: "Query",
        });
        Reflect.defineMetadata(GRAPHQL_RESOLVERS_KEY, existing, target.constructor);
    };
}

export function Mutation(fieldName: string) {
    return function (target: any, propertyKey: string, _descriptor?: PropertyDescriptor) {
        const existing: GraphQLResolver[] = Reflect.getMetadata(GRAPHQL_RESOLVERS_KEY, target.constructor) || [];
        existing.push({
            target: target.constructor,
            fieldName,
            parentType: "Mutation",
        });
        Reflect.defineMetadata(GRAPHQL_RESOLVERS_KEY, existing, target.constructor);
    };
}

export function Subscription(fieldName: string) {
    return function (target: any, propertyKey: string, _descriptor?: PropertyDescriptor) {
        const existing: GraphQLResolver[] = Reflect.getMetadata(GRAPHQL_RESOLVERS_KEY, target.constructor) || [];
        existing.push({
            target: target.constructor,
            fieldName,
            parentType: "Subscription",
        });
        Reflect.defineMetadata(GRAPHQL_RESOLVERS_KEY, existing, target.constructor);
    };
}

export function GraphQLType(typeName: string) {
    return function <T extends new (...args: any[]) => any>(target: T): T {
        const existing = Reflect.getMetadata(GRAPHQL_TYPES_KEY, target) || [];
        existing.push(typeName);
        Reflect.defineMetadata(GRAPHQL_TYPES_KEY, existing, target);
        return target;
    };
}

export function GraphQLField(fieldName: string, type: string) {
    return function (target: any, propertyKey: string, _descriptor?: PropertyDescriptor) {
        const existing = Reflect.getMetadata(GRAPHQL_TYPES_KEY, target.constructor) || [];
        existing.push({ fieldName, type, propertyKey });
        Reflect.defineMetadata(GRAPHQL_TYPES_KEY, existing, target.constructor);
    };
}

export function getResolvers(target: Function): GraphQLResolver[] {
    return Reflect.getMetadata(GRAPHQL_RESOLVERS_KEY, target) || [];
}

export function getRegisteredResolvers(): GraphQLResolver[] {
    const resolvers: GraphQLResolver[] = [];
    const targets = Reflect.getMetadata("design:paramtypes", Function) || [];
    for (const target of targets) {
        resolvers.push(...getResolvers(target));
    }
    return resolvers;
}
