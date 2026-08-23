import { SolumjsHandler } from "./http-types";
import { HttpMethod } from "./route.decorator";

export { HttpMethod } from "./route.decorator";

export interface RouteRegistration {
    method: HttpMethod;
    path: string;
    handler: SolumjsHandler;
}

export interface HttpAdapter {
    registerRoute(prefix: string, route: RouteRegistration): void;
    listen(port: number, callback?: () => void): unknown;
}