import http from "http";
import net from "net";
import crypto from "crypto";
import { container } from "@solumjs/core";

const WS_GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";

export interface WsMessage {
    data: string;
    isBinary: boolean;
}

export interface WsClient {
    id: string;
    send(data: string | Buffer): void;
    close(code?: number, reason?: string): void;
    onMessage(handler: (msg: WsMessage) => void): void;
    onClose(handler: () => void): void;
    readonly readyState: number;
}

export interface WsHandler {
    handleConnection(client: WsClient): void;
}

const WS_HANDLER_METADATA = "custom:ws-handler";

export function WebSocketHandler(path: string = "/ws"): ClassDecorator {
    return function (target: any) {
        Reflect.defineMetadata(WS_HANDLER_METADATA, path, target);
        container.register(target, { useClass: target });
    };
}

export function getWsHandlerPath(target: Function): string | undefined {
    return Reflect.getOwnMetadata(WS_HANDLER_METADATA, target);
}

function acceptWebSocket(req: http.IncomingMessage, socket: net.Socket): void {
    const key = req.headers["sec-websocket-key"];
    if (!key) {
        socket.destroy();
        return;
    }

    const accept = crypto
        .createHash("sha1")
        .update(key + WS_GUID)
        .digest("base64");

    socket.write(
        `HTTP/1.1 101 Switching Protocols\r\n` +
        `Upgrade: websocket\r\n` +
        `Connection: Upgrade\r\n` +
        `Sec-WebSocket-Accept: ${accept}\r\n\r\n`
    );
}

function sendFrame(socket: net.Socket, data: Buffer, opcode: number = 0x1): void {
    const payload = data;
    const mask = crypto.randomBytes(4);

    let header: Buffer;
    if (payload.length < 126) {
        header = Buffer.alloc(6);
        header[0] = 0x80 | opcode;
        header[1] = 0x80 | payload.length;
        mask.copy(header, 2);
    } else if (payload.length < 65536) {
        header = Buffer.alloc(8);
        header[0] = 0x80 | opcode;
        header[1] = 0x80 | 126;
        header.writeUInt16BE(payload.length, 2);
        mask.copy(header, 4);
    } else {
        header = Buffer.alloc(14);
        header[0] = 0x80 | opcode;
        header[1] = 0x80 | 127;
        header.writeBigUInt64BE(BigInt(payload.length), 2);
        mask.copy(header, 10);
    }

    const masked = Buffer.alloc(payload.length);
    for (let i = 0; i < payload.length; i++) {
        masked[i] = payload[i] ^ mask[i % 4];
    }

    socket.write(Buffer.concat([header, masked]));
}

function createWsClient(id: string, socket: net.Socket): WsClient {
    const messageHandlers: Array<(msg: WsMessage) => void> = [];
    const closeHandlers: Array<() => void> = [];

    const client: WsClient = {
        id,
        readyState: 1,
        send(data: string | Buffer) {
            if (socket.destroyed) return;
            const payload = typeof data === "string" ? Buffer.from(data, "utf8") : data;
            sendFrame(socket, payload, 0x1);
        },
        close(code = 1000, reason = "") {
            if (socket.destroyed) return;
            const codeBuf = Buffer.alloc(2);
            codeBuf.writeUInt16BE(code, 0);
            const reasonBuf = Buffer.from(reason, "utf8");
            sendFrame(socket, Buffer.concat([codeBuf, reasonBuf]), 0x8);
            socket.destroy();
        },
        onMessage(handler) {
            messageHandlers.push(handler);
        },
        onClose(handler) {
            closeHandlers.push(handler);
        },
    };

    (socket as any).__wsClient = client;
    (socket as any).__wsMessageHandlers = messageHandlers;
    (socket as any).__wsCloseHandlers = closeHandlers;

    return client;
}

const MAX_WS_FRAME_SIZE = 1024 * 1024;
const MAX_STOMP_FRAME_SIZE = 256 * 1024;
const MAX_STOMP_DESTINATIONS = 1000;

function parseFrame(buffer: Buffer): { opcode: number; payload: Buffer; length: number } | null {
    if (buffer.length < 2) return null;

    const firstByte = buffer[0];
    const secondByte = buffer[1];
    const opcode = firstByte & 0x0f;
    const isMasked = (secondByte & 0x80) !== 0;
    let payloadLength = secondByte & 0x7f;
    let offset = 2;

    if (payloadLength === 126) {
        if (buffer.length < 4) return null;
        payloadLength = buffer.readUInt16BE(2);
        offset = 4;
    } else if (payloadLength === 127) {
        if (buffer.length < 10) return null;
        payloadLength = Number(buffer.readBigUInt64BE(2));
        offset = 10;
    }

    if (payloadLength > MAX_WS_FRAME_SIZE) return null;

    if (isMasked) offset += 4;

    const totalLength = offset + payloadLength;
    if (buffer.length < totalLength) return null;

    let payload = buffer.subarray(offset, offset + payloadLength);
    if (isMasked) {
        const maskKey = buffer.subarray(offset - 4, offset);
        payload = Buffer.from(payload);
        for (let i = 0; i < payload.length; i++) {
            payload[i] ^= maskKey[i % 4];
        }
    }

    return { opcode, payload, length: totalLength };
}

export interface WebSocketOptions {
    authToken?: string;
}

const WS_IDLE_TIMEOUT_MS = 5 * 60 * 1000;
const MAX_WS_CONNECTIONS = 1000;
const MAX_WS_BUFFER_SIZE = 256 * 1024;
let wsConnectionCount = 0;

function timingSafeEqual(a: string, b: string): boolean {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    if (bufA.length !== bufB.length) {
        crypto.timingSafeEqual(bufA, Buffer.alloc(bufA.length));
        return false;
    }
    return crypto.timingSafeEqual(bufA, bufB);
}

const wsUpgradeLimits = new Map<string, { count: number; resetAt: number }>();
const WS_UPGRADE_MAX = 30;
const WS_UPGRADE_WINDOW_MS = 60 * 1000;

function checkWsUpgradeRateLimit(ip: string): boolean {
    const now = Date.now();
    let bucket = wsUpgradeLimits.get(ip);
    if (!bucket || bucket.resetAt <= now) {
        bucket = { count: 0, resetAt: now + WS_UPGRADE_WINDOW_MS };
        wsUpgradeLimits.set(ip, bucket);
    }
    bucket.count++;
    return bucket.count <= WS_UPGRADE_MAX;
}

export function mountWebSocket(server: http.Server, handlers: Map<string, WsHandler>, options: WebSocketOptions = {}): void {
    server.on("upgrade", (req, socket, head) => {
        if (!validateOrigin(req)) {
            socket.destroy();
            return;
        }

        const ip = req.socket.remoteAddress ?? "unknown";
        if (!checkWsUpgradeRateLimit(ip)) {
            socket.write("HTTP/1.1 429 Too Many Requests\r\n\r\n");
            socket.destroy();
            return;
        }

        if (wsConnectionCount >= MAX_WS_CONNECTIONS) {
            socket.write("HTTP/1.1 503 Service Unavailable\r\n\r\n");
            socket.destroy();
            return;
        }

        if (options.authToken) {
            const url = new URL(req.url || "/", `http://${req.headers.host}`);
            const token = url.searchParams.get("token") ?? req.headers.authorization?.replace("Bearer ", "");
            if (!token || !timingSafeEqual(token, options.authToken)) {
                socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
                socket.destroy();
                return;
            }
        }

        const url = new URL(req.url || "/", `http://${req.headers.host}`);
        let matchedHandler: WsHandler | undefined;
        let matchedPath: string | undefined;

        for (const [path, handler] of handlers) {
            if (url.pathname === path) {
                matchedHandler = handler;
                matchedPath = path;
                break;
            }
        }

        if (!matchedHandler || !matchedPath) {
            socket.destroy();
            return;
        }

        acceptWebSocket(req, socket as net.Socket);
        wsConnectionCount++;

        const socketRef = socket as net.Socket;
        socketRef.setTimeout(WS_IDLE_TIMEOUT_MS);
        socketRef.on("timeout", () => {
            socketRef.destroy();
        });

        const clientId = crypto.randomUUID();
        const client = createWsClient(clientId, socket as net.Socket);

        let buffer = Buffer.alloc(0);

        socket.on("data", (chunk: Buffer) => {
            buffer = Buffer.concat([buffer, chunk]);
            if (buffer.length > MAX_WS_BUFFER_SIZE) {
                socket.destroy();
                return;
            }

            while (buffer.length > 0) {
                const frame = parseFrame(buffer);
                if (!frame) break;

                buffer = buffer.subarray(frame.length);

                if (frame.opcode === 0x1 || frame.opcode === 0x2) {
                    const msg: WsMessage = {
                        data: frame.payload.toString("utf8"),
                        isBinary: frame.opcode === 0x2,
                    };
                    for (const handler of (socket as any).__wsMessageHandlers) {
                        handler(msg);
                    }
                } else if (frame.opcode === 0x8) {
                    for (const handler of (socket as any).__wsCloseHandlers) {
                        handler();
                    }
                    socket.destroy();
                    return;
                } else if (frame.opcode === 0x9) {
                    const pong = Buffer.alloc(2);
                    pong[0] = 0x8a;
                    pong[1] = 0x00;
                    socket.write(pong);
                } else {
                    socket.destroy();
                    return;
                }
            }
        });

        socket.on("close", () => {
            wsConnectionCount = Math.max(0, wsConnectionCount - 1);
            for (const handler of (socket as any).__wsCloseHandlers) {
                handler();
            }
        });

        matchedHandler.handleConnection(client);
    });
}

export interface StompFrame {
    command: string;
    headers: Record<string, string>;
    body: string;
}

export function parseStompFrame(raw: string): StompFrame | null {
    if (raw.length > MAX_STOMP_FRAME_SIZE) return null;
    const lines = raw.split("\r\n");
    if (lines.length === 0) return null;

    const command = lines[0].trim();
    if (!command) return null;

    const headers: Record<string, string> = {};
    let bodyStartIndex = 0;

    for (let i = 1; i < lines.length; i++) {
        if (lines[i] === "") {
            bodyStartIndex = i + 1;
            break;
        }
        const colonIndex = lines[i].indexOf(":");
        if (colonIndex > 0) {
            const key = lines[i].slice(0, colonIndex).trim();
            const value = lines[i].slice(colonIndex + 1).trim();
            headers[key] = value;
        }
    }

    const body = lines.slice(bodyStartIndex).join("\r\n").replace(/\0$/, "");

    return { command, headers, body };
}

export function serializeStompFrame(command: string, headers: Record<string, string> = {}, body: string = ""): string {
    let frame = command + "\r\n";
    for (const [key, value] of Object.entries(headers)) {
        frame += `${key}:${value}\r\n`;
    }
    frame += "\r\n" + body + "\0";
    return frame;
}

const STOMP_HANDLER_METADATA = "custom:stomp-handler";
const STOMP_SUBSCRIPTIONS = new Map<string, Set<WsClient>>();

export function MessageMapping(destination: string): MethodDecorator {
    return function (target: any, propertyKey: string | symbol) {
        const existing: Array<{ destination: string; methodName: string }> =
            Reflect.getOwnMetadata(STOMP_HANDLER_METADATA, target.constructor) || [];
        existing.push({ destination, methodName: propertyKey as string });
        Reflect.defineMetadata(STOMP_HANDLER_METADATA, existing, target.constructor);
    };
}

export function getStompHandlers(target: Function): Array<{ destination: string; methodName: string }> {
    return Reflect.getOwnMetadata(STOMP_HANDLER_METADATA, target) || [];
}

export function StompHandler(): ClassDecorator {
    return function (target: any) {
        Reflect.defineMetadata(WS_HANDLER_METADATA, "/stomp", target);
        container.register(target, { useClass: target });
    };
}

const HTML_ESCAPE_MAP: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#x27;",
};

function sanitizeStompBody(body: string): string {
    return body.replace(/[&<>"']/g, (char) => HTML_ESCAPE_MAP[char] ?? char);
}

function validateOrigin(req: http.IncomingMessage): boolean {
    const origin = req.headers.origin;
    if (!origin) return false;
    try {
        const originUrl = new URL(origin);
        const host = req.headers.host;
        if (host && originUrl.host === host) return true;
        return false;
    } catch {
        return false;
    }
}

export function createStompHandler(instance: any): WsHandler {
    const handlers = getStompHandlers(instance.constructor);

    return {
        handleConnection(client: WsClient) {
            client.onMessage((msg) => {
                const frame = parseStompFrame(msg.data);
                if (!frame) return;

                switch (frame.command) {
                    case "CONNECT":
                    case "STOMP":
                        client.send(serializeStompFrame("CONNECTED", { version: "1.2" }));
                        break;

case "SUBSCRIBE": {
                        const destination = frame.headers["destination"];
                        const id = frame.headers["id"] || destination;
                        if (destination) {
                            const destLower = destination.toLowerCase();
                            if (destLower.startsWith("/internal/") || destLower.startsWith("/system/")) {
                                client.send(serializeStompFrame("ERROR", { message: "Access denied to internal destination" }));
                                break;
                            }
                            if (!STOMP_SUBSCRIPTIONS.has(destination)) {
                                if (STOMP_SUBSCRIPTIONS.size >= MAX_STOMP_DESTINATIONS) {
                                    client.send(serializeStompFrame("ERROR", { message: "Too many destinations" }));
                                    break;
                                }
                                STOMP_SUBSCRIPTIONS.set(destination, new Set());
                            }
                            const destSubs = STOMP_SUBSCRIPTIONS.get(destination)!;
                            const clientSubCount = [...STOMP_SUBSCRIPTIONS.values()].filter(s => s.has(client)).length;
                            if (clientSubCount >= 100) {
                                client.send(serializeStompFrame("ERROR", { message: "Too many subscriptions" }));
                                break;
                            }
                            destSubs.add(client);
                            client.send(serializeStompFrame("RECEIPT", { "receipt-id": id }));
                        }
                        break;
                    }

                    case "UNSUBSCRIBE": {
                        const dest = frame.headers["destination"];
                        if (dest) {
                            const subs = STOMP_SUBSCRIPTIONS.get(dest);
                            if (subs) {
                                subs.delete(client);
                                if (subs.size === 0) {
                                    STOMP_SUBSCRIPTIONS.delete(dest);
                                }
                            }
                        }
                        break;
                    }

                    case "SEND": {
                        const dest = frame.headers["destination"];
                        if (dest) {
                            const handler = handlers.find((h) => h.destination === dest);
                            if (handler) {
                                const method = instance[handler.methodName];
                                if (typeof method === "function") {
                                    const result = method.call(instance, frame.body, client);
                                    if (result !== undefined) {
                                        client.send(serializeStompFrame("MESSAGE", { destination: dest }, String(result)));
                                    }
                                }
                            }

                            const subscribers = STOMP_SUBSCRIPTIONS.get(dest);
                            if (subscribers) {
                                const sanitized = sanitizeStompBody(frame.body);
                                for (const sub of subscribers) {
                                    if (sub.id !== client.id) {
                                        sub.send(serializeStompFrame("MESSAGE", { destination: dest }, sanitized));
                                    }
                                }
                            }
                        }
                        break;
                    }

                    case "DISCONNECT":
                        client.close();
                        break;
                }
            });

            client.onClose(() => {
                for (const [dest, subscribers] of STOMP_SUBSCRIPTIONS) {
                    subscribers.delete(client);
                    if (subscribers.size === 0) {
                        STOMP_SUBSCRIPTIONS.delete(dest);
                    }
                }
            });
        },
    };
}
