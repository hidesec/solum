import http from "http";
import https from "https";
import dns from "dns";
import { container } from "@solumjs/core";

const MAX_REDIRECTS = 5;
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

function isPrivateIP(ip: string): boolean {
    const clean = ip.replace(/^\[|]$/g, "").toLowerCase();
    if (clean === "127.0.0.1" || clean === "::1" || clean === "0.0.0.0") return true;
    if (clean === "localhost") return true;
    const parts = clean.split(".");
    if (parts.length === 4) {
        const [a, b] = parts.map(Number);
        if (a === 10) return true;
        if (a === 172 && b >= 16 && b <= 31) return true;
        if (a === 192 && b === 168) return true;
        if (a === 169 && parts[1] === "254") return true;
    }
    if (clean.startsWith("::ffff:")) {
        const v4 = clean.slice(7);
        const v4Parts = v4.split(".");
        if (v4Parts.length === 4) {
            const [a, b] = v4Parts.map(Number);
            if (a === 10) return true;
            if (a === 172 && b >= 16 && b <= 31) return true;
            if (a === 192 && b === 168) return true;
            if (a === 169 && v4Parts[1] === "254") return true;
            if (a === 127) return true;
        }
    }
    return false;
}

function resolveAndCheck(hostname: string): Promise<void> {
    return new Promise((resolve, reject) => {
        dns.lookup(hostname, { all: true }, (err, addresses) => {
            if (err) {
                reject(new Error("SSRF protection: DNS resolution failed"));
                return;
            }
            for (const addr of addresses) {
                if (isPrivateIP(addr.address)) {
                    reject(new Error("SSRF protection: resolved to private/internal address"));
                    return;
                }
            }
            resolve();
        });
    });
}

function makeRequest(options: RequestOptions, redirectCount = 0): Promise<unknown> {
    return new Promise((resolve, reject) => {
        const url = new URL(options.url);

        if (!["http:", "https:"].includes(url.protocol)) {
            reject(new Error("SSRF protection: only HTTP/HTTPS protocols are allowed"));
            return;
        }

        const hostname = url.hostname.toLowerCase();
        if (
            hostname.endsWith(".local") ||
            hostname.endsWith(".internal")
        ) {
            reject(new Error("SSRF protection: requests to internal domains are blocked"));
            return;
        }

        resolveAndCheck(hostname).then(() => {
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
                    if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                        if (redirectCount >= MAX_REDIRECTS) {
                            reject(new Error("SSRF protection: too many redirects"));
                            res.resume();
                            return;
                        }
                        try {
                            const redirectUrl = new URL(res.headers.location, options.url);
                            res.resume();
                            resolve(makeRequest({
                                ...options,
                                url: redirectUrl.toString(),
                            }, redirectCount + 1));
                        } catch {
                            reject(new Error("SSRF protection: invalid redirect URL"));
                            res.resume();
                        }
                        return;
                    }

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
        }).catch(reject);
    });
}
