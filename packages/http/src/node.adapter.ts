import http, { IncomingMessage, Server, ServerResponse } from "http";
import crypto from "crypto";
import { BadRequestException, PayloadTooLargeException, runWithRequestContext } from "@solumjs/core";
import { HttpAdapter, RouteRegistration } from "./http-adapter";
import { Router } from "./router";
import { parseCookies, serializeSetCookie } from "./cookies";
import { extractBoundary, parseMultipart } from "./multipart";
import {
    addInterceptors as addInterceptorsToRegistry,
    InterceptorRegistrationOptions,
    InterceptorClass,
    HandlerInterceptor,
} from "./interceptor";
import { serveStatic, StaticOptions } from "./static";
import {
    CookieOptions,
    SolumEventStream,
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

function toSolumjsRequest(req: IncomingMessage, body: unknown, files?: import("./http-types").UploadedFile[]): SolumjsRequest {
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
        cookies: parseCookies(req.headers.cookie),
        files,
    };
}

function toSolumjsResponse(res: ServerResponse): SolumjsResponse {
    let setCookieHeaders: string[] | undefined;

    function appendSetCookie(cookie: string): void {
        const existing = res.getHeader("set-cookie");
        const previous = Array.isArray(existing)
            ? existing.map(String)
            : existing !== undefined
              ? [String(existing)]
              : [];
        setCookieHeaders = [...(setCookieHeaders ?? previous), cookie];
        res.setHeader("set-cookie", setCookieHeaders);
    }

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
        write(chunk: string | Buffer) {
            return res.write(chunk);
        },
        setCookie(name: string, value: string, options?: CookieOptions) {
            appendSetCookie(serializeSetCookie(name, value, options));
            return wrapper;
        },
        clearCookie(name: string, options?: CookieOptions) {
            appendSetCookie(serializeSetCookie(name, "", { ...options, maxAge: 0 }));
            return wrapper;
        },
        sse(): SolumEventStream {
            res.setHeader("content-type", "text/event-stream");
            res.setHeader("cache-control", "no-cache, no-transform");
            res.setHeader("connection", "keep-alive");
            res.flushHeaders();

            let closed = false;

            const stream: SolumEventStream = {
                send(data: unknown, event?: string) {
                    if (closed || res.writableEnded) return false;
                    const payload =
                        typeof data === "string" ? data.replace(/\r?\n/g, "\ndata: ") : JSON.stringify(data);
                    const frame = `${event ? `event: ${event}\n` : ""}data: ${payload}\n\n`;
                    return res.write(frame);
                },
                comment(text: string) {
                    if (closed || res.writableEnded) return false;
                    return res.write(`: ${text}\n\n`);
                },
                close() {
                    if (closed) return;
                    closed = true;
                    res.end();
                },
                get closed() {
                    return closed || res.writableEnded;
                },
            };

            res.on("close", () => {
                closed = true;
            });

            return stream;
        },
        get headersSent() {
            return res.headersSent;
        },
        raw: res,
    };
    return wrapper;
}

interface ReadBodyResult {
    body: unknown;
    files?: import("./http-types").UploadedFile[];
}

function collectRawBody(req: IncomingMessage, limitBytes: number): Promise<Buffer | undefined> {
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
            resolveBody(chunks.length === 0 ? undefined : Buffer.concat(chunks));
        });

        req.on("error", rejectBody);
    });
}

async function readBody(incoming: IncomingMessage, limitBytes: number): Promise<ReadBodyResult> {
    const raw = await collectRawBody(incoming, limitBytes);
    if (!raw) return { body: undefined };

    const contentType = (incoming.headers["content-type"] ?? "").split(";")[0].trim().toLowerCase();

    if (contentType === "multipart/form-data") {
        const boundary = extractBoundary(incoming.headers["content-type"]);
        if (!boundary) {
            throw new BadRequestException("Malformed multipart request: missing boundary");
        }
        const parsed = parseMultipart(raw, boundary);
        return { body: parsed.fields, files: parsed.files.length > 0 ? parsed.files : undefined };
    }

    if (contentType === "application/x-www-form-urlencoded") {
        return { body: Object.fromEntries(new URLSearchParams(raw.toString("utf8")).entries()) };
    }

    if (contentType === "application/json" || contentType === "") {
        try {
            return { body: JSON.parse(raw.toString("utf8")) };
        } catch {
            throw new BadRequestException("Malformed JSON body");
        }
    }

    return { body: raw.toString("utf8") };
}

export class NodeHttpAdapter implements HttpAdapter {
    private readonly router = new Router();
    private readonly middlewares: SolumjsMiddleware[] = [];
    private server?: Server;

    constructor(private readonly options: AdapterOptions) {}

    use(...middlewares: SolumjsMiddleware[]): void {
        this.middlewares.push(...middlewares);
    }

    useStatic(rootDir: string, options: StaticOptions = {}): void {
        this.use(serveStatic(rootDir, options));
    }

    addInterceptors(
        interceptorOrClass: HandlerInterceptor | InterceptorClass,
        options: InterceptorRegistrationOptions = {}
    ): void {
        addInterceptorsToRegistry(interceptorOrClass, options);
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
        const rawCookie = incoming.headers?.cookie ?? "";
        const cookies: Record<string, string> = {};
        rawCookie.split(";").forEach((pair: string) => {
            const [k, ...rest] = pair.split("=");
            if (k) cookies[k.trim()] = rest.join("=").trim();
        });
        const sessionId = cookies["solum.sid"] || crypto.randomUUID();
        await runWithRequestContext(() => this.handleRequest(incoming, serverRes), sessionId);
    }

    private async handleRequest(incoming: IncomingMessage, serverRes: ServerResponse): Promise<void> {
        let bodyResult: ReadBodyResult = { body: undefined };

        if (["POST", "PUT", "PATCH", "DELETE"].includes((incoming.method ?? "").toUpperCase())) {
            bodyResult = await readBody(incoming, this.options.bodyLimitBytes ?? 1024 * 1024);
        }

        const req = toSolumjsRequest(incoming, bodyResult.body, bodyResult.files);
        const res = toSolumjsResponse(serverRes);

        const stack: SolumjsMiddleware[] = [
            ...this.middlewares,
            async (rq, rs, next) => {
                const match = this.router.match(rq.method, rq.path);
                if (!match) {
                    next();
                    return;
                }
                rq.params = match.params;

                try {
                    await Promise.resolve(match.handler(rq, rs, next));
                } catch (err) {
                    next(err);
                }
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
