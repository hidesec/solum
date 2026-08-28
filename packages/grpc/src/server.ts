import net from "net";
import { container, getFrameworkLogger } from "@solumjs/core";
import { GrpcServiceDefinition, getGrpcServiceDefinition } from "./decorators";

export interface GrpcServerOptions {
    port?: number;
    host?: string;
    maxConnections?: number;
}

export interface GrpcServer {
    start(): Promise<void>;
    stop(): Promise<void>;
    getPort(): number;
}

class GrpcFrame {
    static readonly HEADER_SIZE = 9;
    static readonly COMPRESSED_FLAG = 0x01;
    static readonly MAX_FRAME_SIZE = 1024 * 1024;
    static readonly MAX_JSON_DEPTH = 5;

    static encode(type: "unary" | "server_streaming" | "client_streaming" | "bidirectional", data: Buffer): Buffer {
        const flag = type === "unary" ? 0 : (type === "server_streaming" ? 1 : 0);
        const header = Buffer.alloc(9);
        header.writeUInt8(flag, 0);
        header.writeUInt32BE(data.length, 1);
        header.writeUInt32BE(0, 5);
        return Buffer.concat([header, data]);
    }

    static decode(buffer: Buffer): { type: string; data: Buffer; length: number } | null {
        if (buffer.length < 9) return null;

        const flag = buffer.readUInt8(0);
        const length = buffer.readUInt32BE(1);
        const _reserved = buffer.readUInt32BE(5);

        if (length > this.MAX_FRAME_SIZE) {
            throw new Error("Frame size exceeds maximum");
        }

        if (buffer.length < 9 + length) return null;

        const data = buffer.subarray(9, 9 + length);
        const type = flag === 0 ? "unary" : "streaming";

        return { type, data, length: 9 + length };
    }

    static safeJsonParse(data: Buffer): any {
        const str = data.toString("utf8");
        const parsed = JSON.parse(str);
        let depth = 0;
        const checkDepth = (obj: any): void => {
            if (depth > this.MAX_JSON_DEPTH) {
                throw new Error("JSON depth exceeds maximum");
            }
            if (obj && typeof obj === "object") {
                depth++;
                for (const key of Object.keys(obj)) {
                    checkDepth(obj[key]);
                }
                depth--;
            }
        };
        checkDepth(parsed);
        return parsed;
    }
}

function createGrpcHandler(definition: GrpcServiceDefinition) {
    const instance = container.resolve(definition.target);

    return (data: Buffer): Buffer => {
        try {
            const request = GrpcFrame.safeJsonParse(data);
            const methodName = request.method;

            const methodDef = definition.methods.find((m) => m.methodName === methodName);
            if (!methodDef) {
                const error = { code: 12, message: "Method not found" };
                return Buffer.from(JSON.stringify({ error }));
            }

            const handler = instance[methodDef.propertyKey];
            if (!handler) {
                const error = { code: 13, message: "Handler not implemented" };
                return Buffer.from(JSON.stringify({ error }));
            }

            const result = handler.call(instance, request.data);
            return Buffer.from(JSON.stringify({ data: result }));
        } catch (error) {
            const grpcError = {
                code: 13,
                message: "Internal server error",
            };
            return Buffer.from(JSON.stringify({ error: grpcError }));
        }
    };
}

export function createGrpcServer(
    services: GrpcServiceDefinition[],
    options: GrpcServerOptions = {}
): GrpcServer {
    const logger = getFrameworkLogger();
    const port = options.port ?? 50051;
    const host = options.host ?? "0.0.0.0";
    const maxConnections = options.maxConnections ?? 100;

    const handlers = new Map<string, (data: Buffer) => Buffer>();
    let server: net.Server | null = null;
    let connectionCount = 0;

    for (const service of services) {
        const handler = createGrpcHandler(service);
        handlers.set(service.serviceName, handler);
        logger.info(`gRPC service registered: ${service.serviceName}`);
    }

    function handleConnection(socket: net.Socket): void {
        if (connectionCount >= maxConnections) {
            socket.destroy();
            return;
        }

        connectionCount++;
        let buffer = Buffer.alloc(0);
        let closed = false;

        socket.on("data", (chunk: Buffer) => {
            buffer = Buffer.concat([buffer, chunk]);

            while (buffer.length >= GrpcFrame.HEADER_SIZE) {
                const frame = GrpcFrame.decode(buffer);
                if (!frame) break;

                buffer = buffer.subarray(frame.length);

                try {
                    const request = GrpcFrame.safeJsonParse(frame.data);
                    const serviceName = request.service;

                    const handler = handlers.get(serviceName);
                    if (!handler) {
                        const errorResponse = { error: { code: 12, message: "Service not found" } };
                        const errorFrame = GrpcFrame.encode("unary", Buffer.from(JSON.stringify(errorResponse)));
                        socket.write(errorFrame);
                        continue;
                    }

                    const response = handler(frame.data);
                    const responseFrame = GrpcFrame.encode("unary", response);
                    socket.write(responseFrame);
                } catch (error) {
                    const errorResponse = {
                        error: {
                            code: 13,
                            message: "Internal server error",
                        },
                    };
                    const errorFrame = GrpcFrame.encode("unary", Buffer.from(JSON.stringify(errorResponse)));
                    socket.write(errorFrame);
                }
            }
        });

        socket.on("close", () => {
            if (!closed) {
                closed = true;
                connectionCount = Math.max(0, connectionCount - 1);
            }
        });

        socket.on("error", (error) => {
            logger.error({ error }, "gRPC connection error");
            if (!closed) {
                closed = true;
                connectionCount = Math.max(0, connectionCount - 1);
            }
        });
    }

    return {
        async start(): Promise<void> {
            return new Promise((resolve) => {
                server = net.createServer(handleConnection);
                server.listen(port, host, () => {
                    logger.info(`gRPC server listening on ${host}:${port}`);
                    resolve();
                });
            });
        },

        async stop(): Promise<void> {
            return new Promise((resolve) => {
                if (server) {
                    server.close(() => {
                        resolve();
                    });
                } else {
                    resolve();
                }
            });
        },

        getPort(): number {
            return port;
        },
    };
}
