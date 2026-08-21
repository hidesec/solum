import { HttpMethod, RouteRegistration } from "./http-adapter";
import { SolumjsHandler } from "./http-types";

export interface RouteMatch {
    handler: SolumjsHandler;
    params: Record<string, string>;
}

interface RouteEntry {
    method: string;
    segments: string[];
    handler: SolumjsHandler;
}

function normalize(path: string): string {
    const cleaned = path.replace(/\/{2,}/g, "/");
    return cleaned.length > 1 && cleaned.endsWith("/") ? cleaned.slice(0, -1) : cleaned;
}

function matchSegments(pattern: string[], actual: string[]): Record<string, string> | null {
    if (pattern.length !== actual.length) return null;

    const params: Record<string, string> = {};
    for (let i = 0; i < pattern.length; i++) {
        if (pattern[i].startsWith(":")) {
            params[pattern[i].slice(1)] = decodeURIComponent(actual[i]);
        } else if (pattern[i] !== actual[i]) {
            return null;
        }
    }
    return params;
}

export class Router {
    private readonly routes: RouteEntry[] = [];

    add(method: HttpMethod, prefix: string, path: string, handler: SolumjsHandler): void {
        const pattern = normalize(`${prefix}/${path}`);
        this.routes.push({
            method: method.toUpperCase(),
            segments: pattern.split("/").filter(Boolean),
            handler,
        });
    }

    register(prefix: string, registration: RouteRegistration): void {
        this.add(registration.method, prefix, registration.path, registration.handler);
    }

    match(method: string, path: string): RouteMatch | undefined {
        const parts = normalize(path).split("/").filter(Boolean);
        for (const route of this.routes) {
            if (route.method !== method.toUpperCase()) continue;
            const params = matchSegments(route.segments, parts);
            if (params) return { handler: route.handler, params };
        }
        return undefined;
    }
}
