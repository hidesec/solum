import { HttpAdapter, SolumjsRequest, SolumjsResponse } from "@solumjs/http";
import { container, getFrameworkLogger } from "@solumjs/core";
import { executeGraphQL, GraphQLRequest, GraphQLResponse } from "./executor";
import { SchemaBuilder } from "./schema";
import { getResolvers } from "./decorators";

export interface GraphQLHandlerOptions {
    path?: string;
    graphiql?: boolean;
    playground?: boolean;
    cors?: boolean;
    authGuard?: (req: SolumjsRequest, res: SolumjsResponse) => boolean;
    maxQueryDepth?: number;
}

export function mountGraphQL(adapter: HttpAdapter, schema: SchemaBuilder, options: GraphQLHandlerOptions = {}): void {
    const path = options.path ?? "/graphql";
    const logger = getFrameworkLogger();
    const builtSchema = schema.build();

    const resolverInstances = new Map<string, any>();

    function getResolverInstance(target: new (...args: any[]) => any): any {
        const token = target.name;
        if (!resolverInstances.has(token)) {
            resolverInstances.set(token, container.resolve(target));
        }
        return resolverInstances.get(token);
    }

    adapter.registerRoute("", {
        method: "post",
        path,
        handler: async (req: SolumjsRequest, res: SolumjsResponse) => {
            if (options.authGuard && !options.authGuard(req, res)) {
                res.status(401).json({ errors: [{ message: "Unauthorized" }] });
                return;
            }

            const body = req.body as GraphQLRequest;
            if (!body || !body.query) {
                res.status(400).json({ errors: [{ message: "Query is required" }] });
                return;
            }

            const context = {
                request: req,
                response: res,
                user: (req as any).user,
            };

            const result = executeGraphQL(body.query, builtSchema.resolvers, body.variables, context);
            res.status(200).json(result);
        },
    });

    adapter.registerRoute("", {
        method: "get",
        path,
        handler: async (req: SolumjsRequest, res: SolumjsResponse) => {
            const query = req.query.query as string;
            const variables = req.query.variables as string;

            if (!query) {
                if (options.graphiql !== false) {
                    if (options.authGuard && !options.authGuard(req, res)) {
                        res.status(401).json({ errors: [{ message: "Unauthorized" }] });
                        return;
                    }
                    res.raw.setHeader("content-type", "text/html");
                    res.raw.end(getGraphiQLHtml(path));
                    return;
                }
                res.status(400).json({ errors: [{ message: "Query is required" }] });
                return;
            }

            if (options.authGuard && !options.authGuard(req, res)) {
                res.status(401).json({ errors: [{ message: "Unauthorized" }] });
                return;
            }

            let parsedVariables = {};
            if (variables) {
                try {
                    parsedVariables = JSON.parse(variables);
                } catch {
                    res.status(400).json({ errors: [{ message: "Invalid variables JSON" }] });
                    return;
                }
            }

            const context = {
                request: req,
                response: res,
                user: (req as any).user,
            };

            const result = executeGraphQL(query, builtSchema.resolvers, parsedVariables, context);
            res.status(200).json(result);
        },
    });

    logger.info(`GraphQL endpoint mounted at ${path}`);
}

function getGraphiQLHtml(path: string): string {
    return `<!DOCTYPE html>
<html>
<head>
    <title>SolumJS GraphiQL</title>
    <link href="https://unpkg.com/graphiql/graphiql.min.css" rel="stylesheet" />
</head>
<body style="margin:0;">
    <div id="graphiql" style="height:100vh;"></div>
    <script crossorigin src="https://unpkg.com/react/umd/react.production.min.js"></script>
    <script crossorigin src="https://unpkg.com/react-dom/umd/react-dom.production.min.js"></script>
    <script crossorigin src="https://unpkg.com/graphiql/graphiql.min.js"></script>
    <script>
        const fetcher = GraphiQL.createFetcher({ url: '${path}' });
        ReactDOM.render(
            React.createElement(GraphiQL, { fetcher }),
            document.getElementById('graphiql')
        );
    </script>
</body>
</html>`;
}
