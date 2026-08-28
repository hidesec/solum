import net from "net";
import tls from "tls";
import { getFrameworkLogger } from "@solumjs/core";

export interface GrpcClientOptions {
    host?: string;
    port?: number;
    timeout?: number;
    maxRetries?: number;
    tls?: boolean;
    ca?: Buffer;
    cert?: Buffer;
    key?: Buffer;
    rejectUnauthorized?: boolean;
}

export interface GrpcClient {
    invoke<TRequest, TResponse>(service: string, method: string, data: TRequest): Promise<TResponse>;
    close(): Promise<void>;
}

class GrpcClientFrame {
    static readonly HEADER_SIZE = 9;
    static readonly MAX_FRAME_SIZE = 1024 * 1024;

    static encode(data: Buffer): Buffer {
        const header = Buffer.alloc(9);
        header.writeUInt8(0, 0);
        header.writeUInt32BE(data.length, 1);
        header.writeUInt32BE(0, 5);
        return Buffer.concat([header, data]);
    }

    static decode(buffer: Buffer): { data: Buffer; length: number } | null {
        if (buffer.length < 9) return null;

        const length = buffer.readUInt32BE(1);

        if (length > this.MAX_FRAME_SIZE) {
            throw new Error(`Frame size ${length} exceeds maximum ${this.MAX_FRAME_SIZE}`);
        }

        if (buffer.length < 9 + length) return null;

        const data = buffer.subarray(9, 9 + length);
        return { data, length: 9 + length };
    }
}

export function createGrpcClient(options: GrpcClientOptions = {}): GrpcClient {
    const logger = getFrameworkLogger();
    const host = options.host ?? "127.0.0.1";
    const port = options.port ?? 50051;
    const timeout = options.timeout ?? 5000;
    const maxRetries = options.maxRetries ?? 3;

    let socket: net.Socket | null = null;
    let buffer = Buffer.alloc(0);
    let connectionPromise: Promise<void> | null = null;

    function connect(): Promise<void> {
        if (connectionPromise) return connectionPromise;

        connectionPromise = new Promise((resolve, reject) => {
            if (options.tls) {
                const tlsOptions: tls.ConnectionOptions = {
                    rejectUnauthorized: options.rejectUnauthorized !== false,
                };
                if (options.ca) tlsOptions.ca = options.ca;
                if (options.cert) tlsOptions.cert = options.cert;
                if (options.key) tlsOptions.key = options.key;

                socket = tls.connect(port, host, tlsOptions, () => {
                    logger.info(`gRPC client connected to ${host}:${port} (TLS)`);
                    resolve();
                });
            } else {
                socket = new net.Socket();
                socket.connect(port, host, () => {
                    logger.info(`gRPC client connected to ${host}:${port}`);
                    resolve();
                });
            }

            socket.on("data", (chunk: Buffer) => {
                buffer = Buffer.concat([buffer, chunk]);
            });

            socket.on("error", (error) => {
                logger.error({ error }, "gRPC client connection error");
                connectionPromise = null;
                reject(error);
            });

            socket.on("close", () => {
                connectionPromise = null;
            });
        });

        return connectionPromise;
    }

    return {
        async invoke<TRequest, TResponse>(
            service: string,
            method: string,
            data: TRequest
        ): Promise<TResponse> {
            await connect();

            if (!socket) {
                throw new Error("Not connected to gRPC server");
            }

            const request = {
                service,
                method,
                data,
            };

            const requestBuffer = Buffer.from(JSON.stringify(request));
            const frame = GrpcClientFrame.encode(requestBuffer);

            return new Promise((resolve, reject) => {
                const timeoutId = setTimeout(() => {
                    reject(new Error(`gRPC call ${service}/${method} timed out after ${timeout}ms`));
                }, timeout);

                let retries = 0;

                const attemptCall = (): void => {
                    if (!socket) {
                        clearTimeout(timeoutId);
                        reject(new Error("Not connected to gRPC server"));
                        return;
                    }

                    socket.write(frame, (error) => {
                        if (error) {
                            if (retries < maxRetries) {
                                retries++;
                                logger.warn(`gRPC call retry ${retries}/${maxRetries}`);
                                setTimeout(attemptCall, 1000 * retries);
                                return;
                            }
                            clearTimeout(timeoutId);
                            reject(error);
                            return;
                        }

                        const checkResponse = (): void => {
                            const decoded = GrpcClientFrame.decode(buffer);
                            if (decoded) {
                                buffer = buffer.subarray(decoded.length);
                                clearTimeout(timeoutId);

                                try {
                                    const response = JSON.parse(decoded.data.toString("utf8"));
                                    if (response.error) {
                                        reject(new Error(response.error.message));
                                    } else {
                                        resolve(response.data as TResponse);
                                    }
                                } catch (error) {
                                    reject(error);
                                }
                                return;
                            }

                            setTimeout(checkResponse, 10);
                        };

                        checkResponse();
                    });
                };

                attemptCall();
            });
        },

        async close(): Promise<void> {
            return new Promise((resolve) => {
                if (socket) {
                    socket.destroy();
                    socket = null;
                    connectionPromise = null;
                }
                resolve();
            });
        },
    };
}
