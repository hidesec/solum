import https from "https";
import http2 from "http2";
import fs from "fs";
import path from "path";
import { NodeHttpAdapter } from "./node.adapter";
import { getFrameworkLogger, getFrameworkConfig } from "@solumjs/core";

export interface TlsOptions {
    cert: string;
    key: string;
    ca?: string;
    passphrase?: string;
    minVersion?: "TLSv1.2" | "TLSv1.3";
    ciphers?: string;
    alpnProtocols?: string[];
}

export interface Http2Options {
    enabled?: boolean;
}

export interface SecureServerOptions {
    port?: number;
    tls?: TlsOptions;
    http2?: Http2Options;
    onListen?: (port: number, protocol: string) => void;
    baseDir?: string;
}

function resolveTlsOptions(tls: TlsOptions, baseDir?: string): { cert: Buffer; key: Buffer; ca?: Buffer } {
    const resolve = (filePath: string): Buffer => {
        let resolved: string;
        if (path.isAbsolute(filePath)) {
            resolved = filePath;
        } else if (baseDir) {
            resolved = path.resolve(baseDir, filePath);
        } else {
            resolved = path.resolve(process.cwd(), filePath);
        }

        if (fs.existsSync(resolved)) {
            return fs.readFileSync(resolved);
        }

        if (fs.existsSync(filePath) && path.isAbsolute(filePath)) {
            return fs.readFileSync(filePath);
        }

        throw new Error("TLS file not found");
    };

    return {
        cert: resolve(tls.cert),
        key: resolve(tls.key),
        ca: tls.ca ? resolve(tls.ca) : undefined,
    };
}

export function createSecureServer(
    adapter: NodeHttpAdapter,
    options: SecureServerOptions,
    handler: (req: import("http").IncomingMessage, res: import("http").ServerResponse) => void
): import("http").Server | http2.Http2SecureServer {
    const logger = getFrameworkLogger();
    const config = getFrameworkConfig();
    const port = options.port ?? config.getNumber("PORT") ?? 3000;

    if (!options.tls) {
        throw new Error("TLS options (cert, key) are required for secure server");
    }

    const tlsFiles = resolveTlsOptions(options.tls, options.baseDir);

    const tlsConfig = {
        cert: tlsFiles.cert,
        key: tlsFiles.key,
        ca: tlsFiles.ca,
        passphrase: options.tls.passphrase,
        minVersion: options.tls.minVersion ?? "TLSv1.2" as const,
        ciphers: options.tls.ciphers,
        ALPNProtocols: options.http2?.enabled
            ? (options.tls.alpnProtocols ?? ["h2", "http/1.1"])
            : (options.tls.alpnProtocols ?? ["http/1.1"]),
    };

    let server: import("http").Server | http2.Http2SecureServer;

    if (options.http2?.enabled) {
        server = http2.createSecureServer(
            {
                ...tlsConfig,
                allowHTTP1: true,
            }
        );

        server.on("request", (req, res) => {
            handler(req as any, res as any);
        });

        logger.info("HTTP/2 server enabled with ALPN negotiation");
    } else {
        server = https.createServer(tlsConfig, handler);
    }

    server.listen(port, () => {
        const protocol = options.http2?.enabled ? "https (HTTP/2)" : "https";
        logger.info(`${protocol} server listening on port ${port}`);
        options.onListen?.(port, protocol);
    });

    return server;
}

export function loadTlsFromEnv(): TlsOptions | undefined {
    const certPath = process.env.TLS_CERT_PATH;
    const keyPath = process.env.TLS_KEY_PATH;

    if (!certPath || !keyPath) return undefined;

    return {
        cert: certPath,
        key: keyPath,
        ca: process.env.TLS_CA_PATH,
        passphrase: process.env.TLS_PASSPHRASE,
        minVersion: (process.env.TLS_MIN_VERSION as "TLSv1.2" | "TLSv1.3") ?? "TLSv1.2",
    };
}
