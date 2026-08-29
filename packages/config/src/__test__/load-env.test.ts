import { createEnvConfig, loadEnv } from "../load-env";
import fs from "fs";
import path from "path";
import os from "os";

describe("createEnvConfig", () => {
    it("get returns string values", () => {
        const config = createEnvConfig({ PORT: "3000", HOST: "localhost" });
        expect(config.get("PORT")).toBe("3000");
        expect(config.get("HOST")).toBe("localhost");
    });

    it("get returns undefined for missing keys", () => {
        const config = createEnvConfig({ PORT: "3000" });
        expect(config.get("MISSING")).toBeUndefined();
    });

    it("get returns undefined for empty string", () => {
        const config = createEnvConfig({ PORT: "" });
        expect(config.get("PORT")).toBeUndefined();
    });

    it("get returns undefined for null/undefined values", () => {
        const config = createEnvConfig({ PORT: null, HOST: undefined });
        expect(config.get("PORT")).toBeUndefined();
        expect(config.get("HOST")).toBeUndefined();
    });

    it("getNumber returns parsed number", () => {
        const config = createEnvConfig({ PORT: "3000", RATIO: "3.14" });
        expect(config.getNumber("PORT")).toBe(3000);
        expect(config.getNumber("RATIO")).toBeCloseTo(3.14);
    });

    it("getNumber returns undefined for non-numeric", () => {
        const config = createEnvConfig({ PORT: "abc" });
        expect(config.getNumber("PORT")).toBeUndefined();
    });

    it("getNumber returns undefined for missing key", () => {
        const config = createEnvConfig({});
        expect(config.getNumber("PORT")).toBeUndefined();
    });

    it("getBoolean returns true for truthy values", () => {
        const config = createEnvConfig({ A: "true", B: "1", C: "yes", D: "on", E: "TRUE" });
        expect(config.getBoolean("A")).toBe(true);
        expect(config.getBoolean("B")).toBe(true);
        expect(config.getBoolean("C")).toBe(true);
        expect(config.getBoolean("D")).toBe(true);
        expect(config.getBoolean("E")).toBe(true);
    });

    it("getBoolean returns false for falsy values", () => {
        const config = createEnvConfig({ A: "false", B: "0", C: "no" });
        expect(config.getBoolean("A")).toBe(false);
        expect(config.getBoolean("B")).toBe(false);
        expect(config.getBoolean("C")).toBe(false);
    });

    it("getBoolean returns undefined for missing key", () => {
        const config = createEnvConfig({});
        expect(config.getBoolean("FLAG")).toBeUndefined();
    });
});

describe("loadEnv", () => {
    let tmpDir: string;

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "load-env-"));
    });

    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it("loads env file and sets process.env", () => {
        const envPath = path.join(tmpDir, ".env");
        fs.writeFileSync(envPath, "TEST_LOAD_KEY=test-value\nTEST_LOAD_NUM=42\n");

        const originalDir = process.cwd();
        const originalVal = process.env.TEST_LOAD_KEY;
        try {
            process.chdir(tmpDir);
            loadEnv(".env");
            expect(process.env.TEST_LOAD_KEY).toBe("test-value");
            expect(process.env.TEST_LOAD_NUM).toBe("42");
        } finally {
            process.chdir(originalDir);
            if (originalVal !== undefined) {
                process.env.TEST_LOAD_KEY = originalVal;
            } else {
                delete process.env.TEST_LOAD_KEY;
            }
            delete process.env.TEST_LOAD_NUM;
        }
    });

    it("does not override existing env vars", () => {
        const envPath = path.join(tmpDir, ".env");
        fs.writeFileSync(envPath, "EXISTING_KEY=from-file\n");

        const originalDir = process.cwd();
        process.env.EXISTING_KEY = "from-env";
        try {
            process.chdir(tmpDir);
            loadEnv(".env");
            expect(process.env.EXISTING_KEY).toBe("from-env");
        } finally {
            process.chdir(originalDir);
            delete process.env.EXISTING_KEY;
        }
    });

    it("skips comments and empty lines", () => {
        const envPath = path.join(tmpDir, ".env");
        fs.writeFileSync(envPath, "# comment\n\nKEY=value\n");

        const originalDir = process.cwd();
        const originalVal = process.env.KEY;
        try {
            process.chdir(tmpDir);
            loadEnv(".env");
            expect(process.env.KEY).toBe("value");
        } finally {
            process.chdir(originalDir);
            if (originalVal !== undefined) {
                process.env.KEY = originalVal;
            } else {
                delete process.env.KEY;
            }
        }
    });

    it("handles quoted values", () => {
        const envPath = path.join(tmpDir, ".env");
        fs.writeFileSync(envPath, 'QUOTED="hello world"\nSINGLE=\'single quote\'\n');

        const originalDir = process.cwd();
        try {
            process.chdir(tmpDir);
            loadEnv(".env");
            expect(process.env.QUOTED).toBe("hello world");
            expect(process.env.SINGLE).toBe("single quote");
        } finally {
            process.chdir(originalDir);
            delete process.env.QUOTED;
            delete process.env.SINGLE;
        }
    });

    it("does nothing when file does not exist", () => {
        const originalDir = process.cwd();
        try {
            process.chdir(tmpDir);
            expect(() => loadEnv(".nonexistent")).not.toThrow();
        } finally {
            process.chdir(originalDir);
        }
    });
});
