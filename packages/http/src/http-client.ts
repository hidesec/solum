import http from "http";
import https from "https";
import { container } from "@solumjs/core";

const HTTP_CLIENT_METADATA_KEY = "custom:http-client";
const HTTP_METHOD_METADATA_KEY = "custom:http-methods";
const HTTP_INTERCEPTOR_METADATA_KEY = "custom:http-interceptor";

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
    retry?: {
        maxAttempts: number;
        backoffMs?: number;
        backoffMultiplier?: number;
    };
}

export interface RequestInterceptor {
    intercept(request: { method: string; url: string; headers: Record<string, string>; body?: unknown }): Promise<{ method: string; url: string; headers: Record<string, string>; body?: unknown }> | { method: string; url: string; headers: Record<string, string>; body?: unknown };
}

export function UseRequestInterceptor(interceptorClass: new (...args: any[]) => RequestInterceptor): ClassDecorator {
    return function (target: any) {
        const existing: (new (...args: any[]) => RequestInterceptor)[] =
            Reflect.getOwnMetadata(HTTP_INTERCEPTOR_METADATA_KEY, target) || [];
        existing.push(interceptorClass);
        Reflect.defineMetadata(HTTP_INTERCEPTOR_METADATA_KEY, existing, target);
    };
}

export function getRequestInterceptors(target: Function): (new (...args: any[]) => RequestInterceptor)[] {
    return Reflect.getOwnMetadata(HTTP_INTERCEPTOR_METADATA_KEY, target) || [];
}

export function HttpClient(options: HttpClientOptions): ClassDecorator {
    return function (target: any) {
        Reflect.defineMetadata(HTTP_CLIENT_METADATA_KEY, options, target);

        const proxy = new Proxy(target, {
            construct(_ctor, args) {
                const instance = new target(...args);
                const methods: HttpMethodDefinition[] = Reflect.getMetadata(HTTP_METHOD_METADATA_KEY, target.prototype) || [];
                const interceptorClasses = getRequestInterceptors(target);

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

                            let requestConfig = {
                                method: def.method,
                                url,
                                headers: { ...options.headers } as Record<string, string>,
                                body,
                            };

                            for (const interceptorClass of interceptorClasses) {
                                const interceptor = container.resolve(interceptorClass);
                                requestConfig = await interceptor.intercept(requestConfig) as typeof requestConfig;
                            }

                            const executeRequest = () => makeRequest({
                                method: requestConfig.method,
                                url: requestConfig.url,
                                body: requestConfig.body,
                                headers: requestConfig.headers,
                                timeout: options.timeout,
                            });

                            if (def.retry) {
                                const { maxAttempts, backoffMs = 100, backoffMultiplier = 2 } = def.retry;
                                let lastError: unknown;
                                for (let attempt = 1; attempt <= maxAttempts; attempt++) {
                                    try {
                                        return await executeRequest();
                                    } catch (error) {
                                        lastError = error;
                                        if (attempt < maxAttempts) {
                                            const delay = Math.min(backoffMs * Math.pow(backoffMultiplier, attempt - 1), 30000);
                                            await new Promise((r) => setTimeout(r, delay));
                                        }
                                    }
                                }
                                throw lastError;
                            }

                            return executeRequest();
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

export function Retryable(options: { maxAttempts: number; backoffMs?: number; backoffMultiplier?: number }): MethodDecorator {
    return function (target: any, propertyKey: string | symbol, _descriptor?: PropertyDescriptor) {
        const existing: HttpMethodDefinition[] = Reflect.getMetadata(HTTP_METHOD_METADATA_KEY, target) || [];
        const def = existing.find((d) => d.methodName === propertyKey);
        if (def) {
            def.retry = options;
        } else {
            existing.push({
                method: "",
                path: "",
                methodName: propertyKey as string,
                retry: options,
            });
        }
        Reflect.defineMetadata(HTTP_METHOD_METADATA_KEY, existing, target);
    };
}

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

        const hostname = url.hostname.toLowerCase();
        const isInternal = (
            hostname === "localhost" ||
            hostname === "127.0.0.1" ||
            hostname === "::1" ||
            hostname === "0.0.0.0" ||
            hostname === "[::1]" ||
            hostname === "[0:0:0:0:0:0:0:1]" ||
            hostname.startsWith("[::ffff:") ||
            hostname.startsWith("10.") ||
            hostname.startsWith("192.168.") ||
            /^172\.(1[6-9]|2[0-9]|3[01])\./.test(hostname) ||
            /^169\.254\./.test(hostname) ||
            hostname.endsWith(".local") ||
            hostname.endsWith(".internal")
        );
        if (isInternal) {
            reject(new Error("SSRF protection: requests to internal/private addresses are blocked"));
            return;
        }

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
