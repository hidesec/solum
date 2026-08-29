import fs from "fs";
import os from "os";
import path from "path";
import { loadTlsFromEnv } from "../tls.adapter";

describe("loadTlsFromEnv", () => {
    const originalEnv = process.env;

    beforeEach(() => {
        process.env = { ...originalEnv };
        delete process.env.TLS_CERT_PATH;
        delete process.env.TLS_KEY_PATH;
        delete process.env.TLS_CA_PATH;
        delete process.env.TLS_PASSPHRASE;
        delete process.env.TLS_MIN_VERSION;
    });

    afterAll(() => {
        process.env = originalEnv;
    });

    it("returns undefined when env vars are missing", () => {
        const result = loadTlsFromEnv();
        expect(result).toBeUndefined();
    });

    it("returns undefined when only cert is set", () => {
        process.env.TLS_CERT_PATH = "/path/cert.pem";
        const result = loadTlsFromEnv();
        expect(result).toBeUndefined();
    });

    it("returns undefined when only key is set", () => {
        process.env.TLS_KEY_PATH = "/path/key.pem";
        const result = loadTlsFromEnv();
        expect(result).toBeUndefined();
    });

    it("returns TlsOptions when cert and key are set", () => {
        process.env.TLS_CERT_PATH = "/path/cert.pem";
        process.env.TLS_KEY_PATH = "/path/key.pem";
        const result = loadTlsFromEnv();
        expect(result).toBeDefined();
        expect(result!.cert).toBe("/path/cert.pem");
        expect(result!.key).toBe("/path/key.pem");
        expect(result!.minVersion).toBe("TLSv1.2");
    });

    it("includes optional fields when set", () => {
        process.env.TLS_CERT_PATH = "/path/cert.pem";
        process.env.TLS_KEY_PATH = "/path/key.pem";
        process.env.TLS_CA_PATH = "/path/ca.pem";
        process.env.TLS_PASSPHRASE = "secret";
        process.env.TLS_MIN_VERSION = "TLSv1.3";

        const result = loadTlsFromEnv();
        expect(result!.ca).toBe("/path/ca.pem");
        expect(result!.passphrase).toBe("secret");
        expect(result!.minVersion).toBe("TLSv1.3");
    });
});

describe("createSecureServer", () => {
    it("throws when no TLS options provided", async () => {
        const { createSecureServer } = await import("../tls.adapter");
        const mockAdapter = {} as any;
        expect(() =>
            createSecureServer(mockAdapter, { port: 3000 }, () => {})
        ).toThrow("TLS options (cert, key) are required");
    });

    it("exports createSecureServer and loadTlsFromEnv", async () => {
        const mod = await import("../tls.adapter");
        expect(typeof mod.createSecureServer).toBe("function");
        expect(typeof mod.loadTlsFromEnv).toBe("function");
    });

    it("creates HTTPS server with valid cert/key files", async () => {
        const { createSecureServer } = await import("../tls.adapter");
        const { NodeHttpAdapter } = await import("../node.adapter");

        const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "tls-test-"));
        const certPath = path.join(tmpDir, "cert.pem");
        const keyPath = path.join(tmpDir, "key.pem");
        fs.copyFileSync("/tmp/solum-test-cert.pem", certPath);
        fs.copyFileSync("/tmp/solum-test-key.pem", keyPath);

        try {
            const adapter = new NodeHttpAdapter({
                notFoundHandler: (_req, res) => res.status(404).json({}),
                errorHandler: (_err, _req, res) => res.status(500).json({}),
            });

            const listenPromise = new Promise<{ port: number; protocol: string }>((resolve) => {
                const server = createSecureServer(adapter, {
                    port: 0,
                    tls: { cert: certPath, key: keyPath },
                    onListen: (port, protocol) => {
                        resolve({ port, protocol });
                    },
                }, (_req, _res) => {});

                expect(server).toBeDefined();
            });

            const result = await listenPromise;
            expect(result.protocol).toBe("https");
            expect(result.port).toBeGreaterThanOrEqual(0);
        } finally {
            fs.rmSync(tmpDir, { recursive: true, force: true });
        }
    });

    it("creates HTTP/2 server with http2.enabled", async () => {
        const { createSecureServer } = await import("../tls.adapter");
        const { NodeHttpAdapter } = await import("../node.adapter");

        const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "tls-h2-test-"));
        const certPath = path.join(tmpDir, "cert.pem");
        const keyPath = path.join(tmpDir, "key.pem");
        fs.copyFileSync("/tmp/solum-test-cert.pem", certPath);
        fs.copyFileSync("/tmp/solum-test-key.pem", keyPath);

        try {
            const adapter = new NodeHttpAdapter({
                notFoundHandler: (_req, res) => res.status(404).json({}),
                errorHandler: (_err, _req, res) => res.status(500).json({}),
            });

            const listenPromise = new Promise<string>((resolve) => {
                const server = createSecureServer(adapter, {
                    port: 0,
                    tls: { cert: certPath, key: keyPath },
                    http2: { enabled: true },
                    onListen: (_port, protocol) => {
                        resolve(protocol);
                    },
                }, (_req, _res) => {});

                expect(server).toBeDefined();
            });

            const protocol = await listenPromise;
            expect(protocol).toBe("https (HTTP/2)");
        } finally {
            fs.rmSync(tmpDir, { recursive: true, force: true });
        }
    });

    it("resolves absolute cert/key paths", async () => {
        const { createSecureServer } = await import("../tls.adapter");
        const { NodeHttpAdapter } = await import("../node.adapter");

        const adapter = new NodeHttpAdapter({
            notFoundHandler: (_req, res) => res.status(404).json({}),
            errorHandler: (_err, _req, res) => res.status(500).json({}),
        });

        const listenPromise = new Promise<void>((resolve) => {
            const server = createSecureServer(adapter, {
                port: 0,
                tls: { cert: "/tmp/solum-test-cert.pem", key: "/tmp/solum-test-key.pem" },
                onListen: () => resolve(),
            }, (_req, _res) => {});
        });

        await listenPromise;
    });

    it("throws when cert file not found", async () => {
        const { createSecureServer } = await import("../tls.adapter");
        const adapter = {} as any;

        expect(() =>
            createSecureServer(adapter, {
                port: 3000,
                tls: { cert: "/nonexistent/cert.pem", key: "/nonexistent/key.pem" },
            }, (_req, _res) => {})
        ).toThrow("TLS file not found");
    });

    it("resolves cert/key relative to baseDir", async () => {
        const { createSecureServer } = await import("../tls.adapter");
        const { NodeHttpAdapter } = await import("../node.adapter");

        const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "tls-basedir-"));
        fs.copyFileSync("/tmp/solum-test-cert.pem", path.join(tmpDir, "cert.pem"));
        fs.copyFileSync("/tmp/solum-test-key.pem", path.join(tmpDir, "key.pem"));

        try {
            const adapter = new NodeHttpAdapter({
                notFoundHandler: (_req, res) => res.status(404).json({}),
                errorHandler: (_err, _req, res) => res.status(500).json({}),
            });

            const listenPromise = new Promise<void>((resolve) => {
                const server = createSecureServer(adapter, {
                    port: 0,
                    baseDir: tmpDir,
                    tls: { cert: "cert.pem", key: "key.pem" },
                    onListen: () => resolve(),
                }, (_req, _res) => {});
            });

            await listenPromise;
        } finally {
            fs.rmSync(tmpDir, { recursive: true, force: true });
        }
    });

    it("accepts custom ALPN protocols", async () => {
        const { createSecureServer } = await import("../tls.adapter");
        const { NodeHttpAdapter } = await import("../node.adapter");

        const adapter = new NodeHttpAdapter({
            notFoundHandler: (_req, res) => res.status(404).json({}),
            errorHandler: (_err, _req, res) => res.status(500).json({}),
        });

        const listenPromise = new Promise<void>((resolve) => {
            const server = createSecureServer(adapter, {
                port: 0,
                tls: {
                    cert: "/tmp/solum-test-cert.pem",
                    key: "/tmp/solum-test-key.pem",
                    alpnProtocols: ["http/1.1"],
                },
                onListen: () => resolve(),
            }, (_req, _res) => {});
        });

        await listenPromise;
    });

    it("onListen receives correct port and protocol", async () => {
        const { createSecureServer } = await import("../tls.adapter");
        const { NodeHttpAdapter } = await import("../node.adapter");

        const adapter = new NodeHttpAdapter({
            notFoundHandler: (_req, res) => res.status(404).json({}),
            errorHandler: (_err, _req, res) => res.status(500).json({}),
        });

        const listenPromise = new Promise<{ port: number; protocol: string }>((resolve) => {
            const server = createSecureServer(adapter, {
                port: 0,
                tls: { cert: "/tmp/solum-test-cert.pem", key: "/tmp/solum-test-key.pem" },
                onListen: (port, protocol) => {
                    resolve({ port, protocol });
                },
            }, (_req, _res) => {});

            expect(server).toBeDefined();
        });

        const result = await listenPromise;
        expect(result.port).toBeGreaterThanOrEqual(0);
        expect(result.protocol).toBe("https");
    });
});
