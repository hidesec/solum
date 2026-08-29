import { mountGraphQL } from "../handler";
import { SchemaBuilder } from "../schema";

function createMockAdapter() {
    const routes: Array<{ method: string; path: string; handler: Function }> = [];
    return {
        routes,
        registerRoute: jest.fn((_prefix: string, route: any) => {
            routes.push(route);
        }),
    };
}

function createMockReq(overrides: Record<string, any> = {}): any {
    return {
        method: "GET",
        path: "/graphql",
        params: {},
        query: {},
        headers: {},
        body: {},
        log: { info: () => {}, warn: () => {}, error: () => {} },
        raw: {},
        cookies: {},
        ...overrides,
    };
}

function createMockRes(): any {
    const headers: Record<string, string> = {};
    let statusCode = 200;
    let body: any = null;

    return {
        get statusCode() { return statusCode; },
        set statusCode(code: number) { statusCode = code; },
        get headersSent() { return false; },
        raw: {
            statusCode,
            setHeader: (k: string, v: string) => { headers[k] = v; },
            end: jest.fn(),
            setHeader: jest.fn(),
            get statusCode() { return statusCode; },
        },
        status(code: number) {
            statusCode = code;
            return this;
        },
        json(data: any) {
            body = data;
            return this;
        },
        headers,
        get body() { return body; },
    };
}

describe("mountGraphQL", () => {
    it("registers POST and GET routes", () => {
        const adapter = createMockAdapter();
        const schema = new SchemaBuilder();
        schema.query("{ hello: String }");
        schema.resolver("Query", "hello", () => "world");

        mountGraphQL(adapter as any, schema, { path: "/gql" });

        expect(adapter.registerRoute).toHaveBeenCalledTimes(2);
        expect(adapter.routes[0].method).toBe("post");
        expect(adapter.routes[0].path).toBe("/gql");
        expect(adapter.routes[1].method).toBe("get");
        expect(adapter.routes[1].path).toBe("/gql");
    });

    it("POST handler returns 400 when no body", async () => {
        const adapter = createMockAdapter();
        const schema = new SchemaBuilder();
        schema.query("{ hello: String }");

        mountGraphQL(adapter as any, schema);

        const postHandler = adapter.routes.find((r) => r.method === "post")!.handler;
        const req = createMockReq({ method: "POST", body: null });
        const res = createMockRes();
        await postHandler(req, res);
        expect(res.statusCode).toBe(400);
    });

    it("POST handler returns 400 when query missing", async () => {
        const adapter = createMockAdapter();
        const schema = new SchemaBuilder();
        schema.query("{ hello: String }");

        mountGraphQL(adapter as any, schema);

        const postHandler = adapter.routes.find((r) => r.method === "post")!.handler;
        const req = createMockReq({ method: "POST", body: {} });
        const res = createMockRes();
        await postHandler(req, res);
        expect(res.statusCode).toBe(400);
    });

    it("POST handler executes query and returns 200", async () => {
        const adapter = createMockAdapter();
        const schema = new SchemaBuilder();
        schema.query("{ hello: String }");
        schema.resolver("Query", "hello", () => "world");

        mountGraphQL(adapter as any, schema);

        const postHandler = adapter.routes.find((r) => r.method === "post")!.handler;
        const req = createMockReq({ method: "POST", body: { query: "{ hello }" } });
        const res = createMockRes();
        await postHandler(req, res);
        expect(res.statusCode).toBe(200);
    });

    it("authGuard blocks POST when guard returns false", async () => {
        const adapter = createMockAdapter();
        const schema = new SchemaBuilder();
        schema.query("{ hello: String }");

        const authGuard = jest.fn().mockReturnValue(false);
        mountGraphQL(adapter as any, schema, { authGuard });

        const postHandler = adapter.routes.find((r) => r.method === "post")!.handler;
        const req = createMockReq({ method: "POST", body: { query: "{ hello }" } });
        const res = createMockRes();
        await postHandler(req, res);
        expect(res.statusCode).toBe(401);
        expect(authGuard).toHaveBeenCalled();
    });

    it("GET handler returns GraphiQL HTML when no query and graphiql enabled", async () => {
        const adapter = createMockAdapter();
        const schema = new SchemaBuilder();
        schema.query("{ hello: String }");

        mountGraphQL(adapter as any, schema, { graphiql: true });

        const getHandler = adapter.routes.find((r) => r.method === "get")!.handler;
        const req = createMockReq({ method: "GET", query: {} });
        const res = createMockRes();
        await getHandler(req, res);

        expect(res.raw.end).toHaveBeenCalled();
    });

    it("GET handler returns 400 when no query and graphiql disabled", async () => {
        const adapter = createMockAdapter();
        const schema = new SchemaBuilder();
        schema.query("{ hello: String }");

        mountGraphQL(adapter as any, schema, { graphiql: false });

        const getHandler = adapter.routes.find((r) => r.method === "get")!.handler;
        const req = createMockReq({ method: "GET", query: {} });
        const res = createMockRes();
        await getHandler(req, res);
        expect(res.statusCode).toBe(400);
    });

    it("GET handler returns 400 for invalid variables JSON", async () => {
        const adapter = createMockAdapter();
        const schema = new SchemaBuilder();
        schema.query("{ hello: String }");

        mountGraphQL(adapter as any, schema);

        const getHandler = adapter.routes.find((r) => r.method === "get")!.handler;
        const req = createMockReq({ method: "GET", query: { query: "{ hello }", variables: "not-json" } });
        const res = createMockRes();
        await getHandler(req, res);
        expect(res.statusCode).toBe(400);
    });

    it("GET handler returns 200 with valid query", async () => {
        const adapter = createMockAdapter();
        const schema = new SchemaBuilder();
        schema.query("{ hello: String }");
        schema.resolver("Query", "hello", () => "world");

        mountGraphQL(adapter as any, schema);

        const getHandler = adapter.routes.find((r) => r.method === "get")!.handler;
        const req = createMockReq({ method: "GET", query: { query: "{ hello }" } });
        const res = createMockRes();
        await getHandler(req, res);
        expect(res.statusCode).toBe(200);
    });

    it("authGuard blocks GET when guard returns false", async () => {
        const adapter = createMockAdapter();
        const schema = new SchemaBuilder();
        schema.query("{ hello: String }");

        const authGuard = jest.fn().mockReturnValue(false);
        mountGraphQL(adapter as any, schema, { authGuard });

        const getHandler = adapter.routes.find((r) => r.method === "get")!.handler;
        const req = createMockReq({ method: "GET", query: { query: "{ hello }" } });
        const res = createMockRes();
        await getHandler(req, res);
        expect(res.statusCode).toBe(401);
    });

    it("uses default path /graphql", () => {
        const adapter = createMockAdapter();
        const schema = new SchemaBuilder();
        schema.query("{ ping: String }");

        mountGraphQL(adapter as any, schema);

        expect(adapter.routes[0].path).toBe("/graphql");
    });

    it("GET handler returns GraphiQL when no query param and no authGuard", async () => {
        const adapter = createMockAdapter();
        const schema = new SchemaBuilder();
        schema.query("{ hello: String }");

        mountGraphQL(adapter as any, schema);

        const getHandler = adapter.routes.find((r) => r.method === "get")!.handler;
        const req = createMockReq({ method: "GET", query: {} });
        const res = createMockRes();
        await getHandler(req, res);
        expect(res.raw.end).toHaveBeenCalled();
    });
});
