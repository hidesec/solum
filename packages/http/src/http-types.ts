import type { IncomingMessage, ServerResponse } from "http";

export interface SolumjsLogger {
    info(obj: object, msg?: string): void;
    warn(obj: object, msg?: string): void;
    error(obj: object, msg?: string): void;
}

export interface SolumjsRequest {
    method: string;
    path: string;
    params: Record<string, string>;
    query: Record<string, unknown>;
    headers: Record<string, string | string[] | undefined>;
    body: any;
    log: SolumjsLogger;
    raw: IncomingMessage;
}

export interface SolumjsResponse {
    status(code: number): this;
    json(body: unknown): void;
    end(): void;
    readonly headersSent: boolean;
    raw: ServerResponse;
}

export type SolumjsNext = (err?: unknown) => void;

export type SolumjsHandler = (req: SolumjsRequest, res: SolumjsResponse, next: SolumjsNext) => unknown;

export type SolumjsMiddleware = (req: SolumjsRequest, res: SolumjsResponse, next: SolumjsNext) => void | Promise<void>;