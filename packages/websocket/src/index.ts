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

export function mountWebSocket(server: http.Server, handlers: Map<string, WsHandler>): void {
    server.on("upgrade", (req, socket, head) => {
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

        const clientId = crypto.randomUUID();
        const client = createWsClient(clientId, socket as net.Socket);

        let buffer = Buffer.alloc(0);

        socket.on("data", (chunk: Buffer) => {
            buffer = Buffer.concat([buffer, chunk]);

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
                }
            }
        });

        socket.on("close", () => {
            for (const handler of (socket as any).__wsCloseHandlers) {
                handler();
            }
        });

        matchedHandler.handleConnection(client);
    });
}
