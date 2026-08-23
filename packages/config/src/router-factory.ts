import { container } from "@solumjs/core";
import { BadRequestException } from "@solumjs/core";
import { toInstance, validateInstance } from "@solumjs/validation";
import { ParamMetadata, ParamSource, ValidOptions, getClassGuards, getHandlerGuards, getParamType, getParamsMetadata, getRegisteredControllers, getResponseStatus, getRoutesMetadata, runGuards, getControllerInterceptors, getHandlerInterceptors, HandlerInterceptor, resolveInterceptors } from "@solumjs/http";
import { findMostSpecificHandler, getExceptionHandlers, getRegisteredAdvice } from "@solumjs/middlewares";
import { HttpAdapter } from "@solumjs/http";
import { SolumjsNext, SolumjsRequest, SolumjsResponse } from "@solumjs/http";
import { AuthenticatedRequest } from "@solumjs/auth";

interface RouteInfo {
    method: string;
    path: string;
}

const registeredRoutes: RouteInfo[] = [];

function joinPaths(prefix: string, path: string): string {
    const full = `${prefix}/${path}`.replace(/\/+/g, "/");
    return full.length > 1 && full.endsWith("/") ? full.slice(0, -1) : full;
}

async function tryHandleWithExceptionHandlers(
    err: Error,
    handlerTarget: Function,
    handlerInstance: any,
    req: SolumjsRequest,
    res: SolumjsResponse
): Promise<boolean> {
    const handlers = getExceptionHandlers(handlerTarget);
    if (handlers.length === 0) return false;

    const match = findMostSpecificHandler(err, handlers);
    if (!match) return false;

    const method = handlerInstance[match.handlerName];
    const result = await method.call(handlerInstance, err, req, res);
    if (res.headersSent) return true;

    const statusFromException = (err as any).statusCode;
    const status = getResponseStatus(handlerTarget, match.handlerName, statusFromException ?? 500);

    res.status(status).json(result ?? { status: "error", message: err.message });
    return true;
}

async function resolveValue(
    meta: ParamMetadata,
    req: SolumjsRequest,
    res: SolumjsResponse,
    next: SolumjsNext
): Promise<unknown> {
    switch (meta.source) {
        case ParamSource.BODY:
            return req.body;
        case ParamSource.PARAM:
            return meta.name ? req.params[meta.name] : req.params;
        case ParamSource.QUERY:
            return meta.name ? req.query[meta.name] : req.query;
        case ParamSource.HEADER:
            return meta.name ? req.headers[meta.name.toLowerCase()] : req.headers;
        case ParamSource.COOKIE: {
            const raw = Array.isArray(req.headers?.cookie) ? req.headers.cookie.join("; ") : (req.headers?.cookie ?? "");
            const cookies: Record<string, string> = {};
            raw.split(";").forEach((pair: string) => {
                const [k, ...rest] = pair.split("=");
                if (k) cookies[k.trim()] = rest.join("=").trim();
            });
            return meta.name ? cookies[meta.name] : cookies;
        }
        case ParamSource.CURRENT_USER:
            return (req as AuthenticatedRequest).user;
        case ParamSource.REQ:
            return req;
        case ParamSource.RES:
            return res;
        case ParamSource.NEXT:
            return next;
    }
}

async function resolveHandlerArgs(
    controllerTarget: Function,
    handlerName: string,
    req: SolumjsRequest,
    res: SolumjsResponse,
    next: SolumjsNext
): Promise<unknown[]> {
    const paramsMeta = getParamsMetadata(controllerTarget, handlerName);

    if (paramsMeta.length === 0) {
        return [req, res, next];
    }

    const args: unknown[] = [];

    for (const meta of paramsMeta.sort((a, b) => a.index - b.index)) {
        let value = await resolveValue(meta, req, res, next);

        if (meta.validate) {
            const dtoClass = getParamType(controllerTarget, handlerName, meta.index);
            if (!dtoClass) {
                throw new Error(
                    `@Valid() on "${controllerTarget.name}.${handlerName}" (param ${meta.index}) could not resolve a DTO type. ` +
                    `Make sure the parameter has an explicit class type, e.g. "dto: CreateUserDto".`
                );
            }

            const options: ValidOptions = meta.validateOptions ?? {};
            const instance = toInstance(dtoClass, value);
            const errors = validateInstance(instance as object, {
                whitelist: options.whitelist ?? false,
                forbidNonWhitelisted: options.forbidNonWhitelisted ?? false,
            });

            if (errors.length > 0) {
                const message = errors
                    .map((e) => Object.values(e.constraints ?? {}))
                    .flat()
                    .join(", ");
                throw new BadRequestException(message);
            }

            value = instance;
        }

        args[meta.index] = value;
    }

    return args;
}

function wrapHandler(
    instance: any,
    handlerName: string,
    controllerTarget: Function
) {
    const handler = instance[handlerName];
    if (typeof handler !== "function") {
        throw new Error(`Handler "${handlerName}" not found on controller "${controllerTarget.name}"`);
    }

    const successStatus = getResponseStatus(controllerTarget, handlerName, 200);
    const declaredInterceptors: HandlerInterceptor[] = [
        ...getControllerInterceptors(controllerTarget),
        ...getHandlerInterceptors(controllerTarget, handlerName),
    ];

    return async (req: SolumjsRequest, res: SolumjsResponse, next: SolumjsNext): Promise<void> => {
        const interceptors = [...resolveInterceptors(req.method, req.path), ...declaredInterceptors];
        let outcomeError: unknown;

        try {
            let stopped = false;
            for (const interceptor of interceptors) {
                if ((await interceptor.preHandle?.(req, res)) === false) {
                    stopped = true;
                    break;
                }
            }

            if (stopped) {
                if (!res.headersSent) {
                    res.status(204).end();
                }
                return;
            }

            const guards = [...getClassGuards(controllerTarget), ...getHandlerGuards(controllerTarget, handlerName)];
            if (guards.length > 0) {
                await runGuards(guards, { classRef: controllerTarget, handlerName, request: req, response: res });
            }

            const args = await resolveHandlerArgs(controllerTarget, handlerName, req, res, next);
            const result = await handler.apply(instance, args);

            if (!res.headersSent) {
                if (result === undefined) {
                    res.status(successStatus).end();
                } else {
                    res.status(successStatus).json(result);
                }
            }

            for (let i = interceptors.length - 1; i >= 0; i--) {
                await interceptors[i].postHandle?.(req, res);
            }
        } catch (err) {
            const error = err instanceof Error ? err : new Error(String(err));
            outcomeError = error;

            if (await tryHandleWithExceptionHandlers(error, controllerTarget, instance, req, res)) {
                return;
            }

            for (const adviceTarget of getRegisteredAdvice()) {
                const adviceInstance = container.resolve(adviceTarget);
                if (await tryHandleWithExceptionHandlers(error, adviceTarget, adviceInstance, req, res)) {
                    return;
                }
            }

            next(error);
        } finally {
            for (const interceptor of interceptors) {
                await interceptor.afterCompletion?.(req, res, outcomeError);
            }
        }
    };
}

export function mountControllers(adapter: HttpAdapter): void {
    getRegisteredControllers().forEach(({ target, prefix }) => {
        const routes = getRoutesMetadata(target);

        if (routes.length === 0) {
            console.warn(`[@RestController] "${target.name}" has no route handlers defined.`);
            return;
        }

        const instance = container.resolve(target);

        routes.forEach(({ method, path, handlerName }) => {
            adapter.registerRoute(prefix, {
                method,
                path,
                handler: wrapHandler(instance, handlerName, target),
            });
            registeredRoutes.push({ method: method.toUpperCase(), path: joinPaths(prefix, path) });
        });
    });
}

export function listRegisteredRoutes(): RouteInfo[] {
    return registeredRoutes;
}