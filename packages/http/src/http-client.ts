import http from "http";
import https from "https";
import { container } from "@solumjs/core";

const HTTP_CLIENT_METADATA_KEY = "custom:http-client";
const HTTP_METHOD_METADATA_KEY = "custom:http-methods";

export interface HttpClientOptions {
    baseUrl: string;
    timeout?: number;
    headers?: Record<string, string>;
}

export interface HttpMethodDefinition {
    method: string;
    path: string;
    paramName?: string;
    methodName?: string;
}

export function HttpClient(options: HttpClientOptions): ClassDecorator {
    return function (target: any) {
        Reflect.defineMetadata(HTTP_CLIENT_METADATA_KEY, options, target);

        const proxy = new Proxy(target, {
            construct(_ctor, args) {
                const instance = new target(...args);
                const methods: HttpMethodDefinition[] = Reflect.getMetadata(HTTP_METHOD_METADATA_KEY, target.prototype) || [];

                for (const def of methods) {
                    if (!def.methodName) continue;
                    const originalMethod = (instance as any)[def.methodName];

                    if (typeof originalMethod === "function") {
                        (instance as any)[def.methodName] = async function (...methodArgs: any[]) {
                            let url = `${options.baseUrl}${def.path}`;

                            if (def.paramName) {
                                const paramValue = methodArgs[0];
                                url = url.replace(`:${def.paramName}`, encodeURIComponent(String(paramValue)));
                            }

                            const body = def.method !== "GET" && def.method !== "DELETE" ? methodArgs[def.paramName ? 1 : 0] : undefined;

                            return makeRequest({
                                method: def.method,
                                url,
                                body,
                                headers: options.headers,
                                timeout: options.timeout,
                            });
                        };
                    }
                }

                return instance;
            },
        });

        container.register(target, { useValue: new proxy() });
    };
}

function createMethodDecorator(method: string) {
    return function (path: string = "/"): MethodDecorator {
        return function (target: any, propertyKey: string | symbol, _descriptor?: PropertyDescriptor) {
            const existing: HttpMethodDefinition[] = Reflect.getMetadata(HTTP_METHOD_METADATA_KEY, target) || [];
            const paramNameMatch = /:([a-zA-Z]+)/.exec(path);
            existing.push({
                method: method.toUpperCase(),
                path,
                paramName: paramNameMatch ? paramNameMatch[1] : undefined,
                methodName: propertyKey as string,
            });
            Reflect.defineMetadata(HTTP_METHOD_METADATA_KEY, existing, target);
        };
    };
}

export const HttpGet = createMethodDecorator("GET");
export const HttpPost = createMethodDecorator("POST");
export const HttpPut = createMethodDecorator("PUT");
export const HttpPatch = createMethodDecorator("PATCH");
export const HttpDelete = createMethodDecorator("DELETE");

interface RequestOptions {
    method: string;
    url: string;
    body?: unknown;
    headers?: Record<string, string>;
    timeout?: number;
}

function makeRequest(options: RequestOptions): Promise<unknown> {
    return new Promise((resolve, reject) => {
        const url = new URL(options.url);
        const isHttps = url.protocol === "https:";
        const client = isHttps ? https : http;

        const headers: Record<string, string> = {
            "content-type": "application/json",
            ...options.headers,
        };

        const bodyStr = options.body ? JSON.stringify(options.body) : undefined;
        if (bodyStr) {
            headers["content-length"] = Buffer.byteLength(bodyStr).toString();
        }

        const req = client.request(
            {
                hostname: url.hostname,
                port: url.port || (isHttps ? 443 : 80),
                path: url.pathname + url.search,
                method: options.method,
                headers,
                timeout: options.timeout || 30000,
            },
            (res) => {
                const chunks: Buffer[] = [];
                res.on("data", (chunk) => chunks.push(chunk));
                res.on("end", () => {
                    const text = Buffer.concat(chunks).toString("utf8");
                    let body: unknown;
                    try {
                        body = JSON.parse(text);
                    } catch {
                        body = text;
                    }

                    if (res.statusCode && res.statusCode >= 400) {
                        const error = new Error(`HTTP ${res.statusCode}: ${text}`);
                        (error as any).statusCode = res.statusCode;
                        (error as any).body = body;
                        reject(error);
                        return;
                    }

                    resolve(body);
                });
            }
        );

        req.on("error", reject);
        req.on("timeout", () => {
            req.destroy();
            reject(new Error(`Request timeout after ${options.timeout || 30000}ms`));
        });

        if (bodyStr) {
            req.write(bodyStr);
        }

        req.end();
    });
}
