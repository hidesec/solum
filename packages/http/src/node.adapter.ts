import http, { IncomingMessage, Server, ServerResponse } from "http";
import { BadRequestException, PayloadTooLargeException, runWithRequestContext } from "@solumjs/core";
import { HttpAdapter, RouteRegistration } from "./http-adapter";
import { Router } from "./router";
import {
    SolumjsLogger,
    SolumjsMiddleware,
    SolumjsRequest,
    SolumjsResponse,
} from "./http-types";

const consoleFallbackLogger: SolumjsLogger = {
    info: (obj, msg) => console.log(msg ?? "", obj),
    warn: (obj, msg) => console.warn(msg ?? "", obj),
    error: (obj, msg) => console.error(msg ?? "", obj),
};

interface AdapterOptions {
    bodyLimitBytes?: number;
    notFoundHandler: (req: SolumjsRequest, res: SolumjsResponse) => void;
    errorHandler: (err: Error, req: SolumjsRequest, res: SolumjsResponse) => void;
}

function toSolumjsRequest(req: IncomingMessage, body: unknown): SolumjsRequest {
    const url = new URL(req.url ?? "/", "http://internal");

    return {
        method: (req.method ?? "GET").toUpperCase(),
        path: url.pathname,
        params: {},
        query: Object.fromEntries(url.searchParams.entries()),
        headers: req.headers,
        body,
        log: consoleFallbackLogger,
        raw: req,
    };
}

function toSolumjsResponse(res: ServerResponse): SolumjsResponse {
    const wrapper: SolumjsResponse = {
        status(code: number) {
            res.statusCode = code;
            return wrapper;
        },
        json(body: unknown) {
            res.setHeader("content-type", "application/json; charset=utf-8");
            res.end(JSON.stringify(body));
        },
        end() {
            res.end();
        },
        get headersSent() {
            return res.headersSent;
        },
        raw: res,
    };
    return wrapper;
}

function readBody(req: IncomingMessage, limitBytes: number): Promise<unknown> {
    return new Promise((resolveBody, rejectBody) => {
        const chunks: Buffer[] = [];
        let size = 0;
        let failed = false;

        req.on("data", (chunk: Buffer) => {
            size += chunk.length;
            if (size > limitBytes) {
                if (!failed) {
                    failed = true;
                    chunks.length = 0;
                    rejectBody(new PayloadTooLargeException(`Request body exceeds limit of ${limitBytes} bytes`));
                }
                return;
            }
            if (!failed) chunks.push(chunk);
        });

        req.on("end", () => {
            if (failed) return;

            if (chunks.length === 0) {
                resolveBody(undefined);
                return;
            }

            try {
                resolveBody(JSON.parse(Buffer.concat(chunks).toString("utf8")));
            } catch {
                rejectBody(new BadRequestException("Malformed JSON body"));
            }
        });

        req.on("error", rejectBody);
    });
}

export class NodeHttpAdapter implements HttpAdapter {
    private readonly router = new Router();
    private readonly middlewares: SolumjsMiddleware[] = [];
    private server?: Server;

    constructor(private readonly options: AdapterOptions) {}

    use(...middlewares: SolumjsMiddleware[]): void {
        this.middlewares.push(...middlewares);
    }

    registerRoute(prefix: string, route: RouteRegistration): void {
        this.router.add(route.method, prefix, route.path, route.handler);
    }

    listen(port: number, callback?: () => void): unknown {
        this.server = http.createServer((req, res) => {
            this.handle(req, res).catch((err) => {
                this.options.errorHandler(err as Error, toSolumjsRequest(req, undefined), toSolumjsResponse(res));
            });
        });

        this.server.listen(port, callback);
        return this.server;
    }

    private async handle(incoming: IncomingMessage, serverRes: ServerResponse): Promise<void> {
        await runWithRequestContext(() => this.handleRequest(incoming, serverRes));
    }

    private async handleRequest(incoming: IncomingMessage, serverRes: ServerResponse): Promise<void> {
        let body: unknown;

        if (["POST", "PUT", "PATCH", "DELETE"].includes((incoming.method ?? "").toUpperCase())) {
            body = await readBody(incoming, this.options.bodyLimitBytes ?? 1024 * 1024);
        }

        const req = toSolumjsRequest(incoming, body);
        const res = toSolumjsResponse(serverRes);

        const stack: SolumjsMiddleware[] = [
            ...this.middlewares,
            (rq, rs, next) => {
                const match = this.router.match(rq.method, rq.path);
                if (!match) {
                    next();
                    return;
                }
                rq.params = match.params;
                Promise.resolve(match.handler(rq, rs, next)).catch(next);
            },
            (_rq, rs) => {
                if (!rs.headersSent) {
                    this.options.notFoundHandler(_rq, rs);
                }
            },
        ];

        const run = (index: number, err?: unknown): void => {
            if (err !== undefined) {
                const error = err instanceof Error ? err : new Error(String(err));
                if (!res.headersSent) {
                    this.options.errorHandler(error, req, res);
                }
                return;
            }

            if (index >= stack.length) return;

            try {
                const result = stack[index](req, res, (e?: unknown) => run(index + 1, e));
                if (result instanceof Promise) {
                    result.catch((e: unknown) => run(index + 1, e));
                }
            } catch (e) {
                run(index + 1, e);
            }
        };

        run(0);
    }
}
