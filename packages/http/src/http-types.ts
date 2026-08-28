import type { IncomingMessage, ServerResponse } from "http";

export interface SolumjsLogger {
    info(obj: object, msg?: string): void;
    warn(obj: object, msg?: string): void;
    error(obj: object, msg?: string): void;
}

export interface UploadedFile {
    fieldname: string;
    filename: string;
    encoding: string;
    mimeType: string;
    buffer: Buffer;
    size: number;
}

export interface Session {
    id: string;
    data: Record<string, unknown>;
    touch(): void;
    destroy(): void;
    regenerate(): string;
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
    cookies?: Record<string, string>;
    files?: UploadedFile[];
    session?: Session;
    version?: string;
}

export interface CookieOptions {
    maxAge?: number;
    domain?: string;
    path?: string;
    secure?: boolean;
    httpOnly?: boolean;
    sameSite?: "Strict" | "Lax" | "None";
}

export interface SolumEventStream {
    send(data: unknown, event?: string): boolean;
    comment(text: string): boolean;
    close(): void;
    readonly closed: boolean;
}

export interface ContentNegotiator {
    negotiate(): "json" | "xml" | "text" | "html";
}

export interface SolumjsResponse {
    status(code: number): this;
    json(body: unknown): void;
    xml(body: unknown): void;
    text(body: string): void;
    html(body: string): void;
    send(body: unknown, contentType?: string): void;
    end(): void;
    write(chunk: string | Buffer): boolean;
    setCookie(name: string, value: string, options?: CookieOptions): this;
    clearCookie(name: string, options?: CookieOptions): this;
    sse(): SolumEventStream;
    negotiate: ContentNegotiator;
    readonly headersSent: boolean;
    raw: ServerResponse;
}

export type SolumjsNext = (err?: unknown) => void;

export type SolumjsHandler = (req: SolumjsRequest, res: SolumjsResponse, next: SolumjsNext) => unknown;

export type SolumjsMiddleware = (req: SolumjsRequest, res: SolumjsResponse, next: SolumjsNext) => void | Promise<void>;
