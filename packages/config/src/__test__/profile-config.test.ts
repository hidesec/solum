import fs from "fs";
import path from "path";
import os from "os";
import { loadProfileConfig, createYamlConfig } from "../profile-config";

describe("loadProfileConfig", () => {
    let tmpDir: string;
    const originalEnv = process.env;

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "profile-config-"));
        process.env = { ...originalEnv };
    });

    afterEach(() => {
        process.env = originalEnv;
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it("returns empty object when no YAML files exist", () => {
        const result = loadProfileConfig(tmpDir);
        expect(result).toEqual({});
    });

    it("reads base application.yml", () => {
        fs.writeFileSync(path.join(tmpDir, "application.yml"), "port: 3000\nhost: localhost\n");
        const result = loadProfileConfig(tmpDir);
        expect(result.port).toBe("3000");
        expect(result.host).toBe("localhost");
    });

    it("merges profile YAML over base", () => {
        fs.writeFileSync(path.join(tmpDir, "application.yml"), "port: 3000\ndebug: false\n");
        process.env.SOLUM_PROFILE = "production";
        fs.writeFileSync(path.join(tmpDir, "application.production.yml"), "port: 8080\ndebug: true\n");
        const result = loadProfileConfig(tmpDir);
        expect(result.port).toBe("8080");
        expect(result.debug).toBe("true");
    });

    it("uses custom config file name", () => {
        fs.writeFileSync(path.join(tmpDir, "custom.yml"), "key: value\n");
        const result = loadProfileConfig(tmpDir, "custom");
        expect(result.key).toBe("value");
    });

    it("resolves environment variable placeholders", () => {
        process.env.TEST_DB_HOST = "db.example.com";
        fs.writeFileSync(path.join(tmpDir, "application.yml"), "db_host: ${TEST_DB_HOST}\n");
        const result = loadProfileConfig(tmpDir);
        expect(result.db_host).toBe("db.example.com");
    });

    it("uses default values when env var missing", () => {
        delete process.env.TEST_MISSING_VAR;
        fs.writeFileSync(path.join(tmpDir, "application.yml"), "key: ${TEST_MISSING_VAR:default_val}\n");
        const result = loadProfileConfig(tmpDir);
        expect(result.key).toBe("default_val");
    });

    it("detects active profile from SOLUM_PROFILE", () => {
        process.env.SOLUM_PROFILE = "staging";
        fs.writeFileSync(path.join(tmpDir, "application.yml"), "mode: base\n");
        fs.writeFileSync(path.join(tmpDir, "application.staging.yml"), "mode: staging\n");
        const result = loadProfileConfig(tmpDir);
        expect(result.mode).toBe("staging");
    });

    it("detects active profile from NODE_ENV when SOLUM_PROFILE not set", () => {
        delete process.env.SOLUM_PROFILE;
        process.env.NODE_ENV = "development";
        fs.writeFileSync(path.join(tmpDir, "application.yml"), "mode: base\n");
        fs.writeFileSync(path.join(tmpDir, "application.development.yml"), "mode: dev\n");
        const result = loadProfileConfig(tmpDir);
        expect(result.mode).toBe("dev");
    });

    it("defaults to development profile when neither set", () => {
        delete process.env.SOLUM_PROFILE;
        delete process.env.NODE_ENV;
        fs.writeFileSync(path.join(tmpDir, "application.yml"), "mode: base\n");
        fs.writeFileSync(path.join(tmpDir, "application.development.yml"), "mode: dev\n");
        const result = loadProfileConfig(tmpDir);
        expect(result.mode).toBe("dev");
    });

    it("handles deeply nested YAML", () => {
        fs.writeFileSync(path.join(tmpDir, "application.yml"), "server:\n  port: 3000\n  ssl:\n    enabled: true\n");
        const result = loadProfileConfig(tmpDir);
        expect(result["server.port"]).toBe("3000");
        expect(result["server.ssl.enabled"]).toBe("true");
    });
});

describe("createYamlConfig", () => {
    let tmpDir: string;
    const originalEnv = process.env;

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "yaml-config-"));
        process.env = { ...originalEnv };
        delete process.env.SOLUM_PROFILE;
        delete process.env.NODE_ENV;
    });

    afterEach(() => {
        process.env = originalEnv;
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it("returns env vars merged with yaml config", () => {
        process.env.MY_CUSTOM_KEY = "from-env";
        fs.writeFileSync(path.join(tmpDir, "application.yml"), "yaml_key: from-yaml\n");
        const result = createYamlConfig(tmpDir);
        expect(result.MY_CUSTOM_KEY).toBe("from-env");
        expect(result.yaml_key).toBe("from-yaml");
    });

    it("env vars take priority over yaml values", () => {
        process.env.PORT = "9090";
        fs.writeFileSync(path.join(tmpDir, "application.yml"), "PORT: 3000\n");
        const result = createYamlConfig(tmpDir);
        expect(result.PORT).toBe("9090");
    });

    it("returns all env vars", () => {
        process.env.TEST_XYZ = "abc";
        const result = createYamlConfig(tmpDir);
        expect(result.TEST_XYZ).toBe("abc");
    });

    it("returns empty object when no yaml and no custom env", () => {
        const result = createYamlConfig(tmpDir);
        expect(typeof result).toBe("object");
    });
});
