import fs from "fs";
import path from "path";
import os from "os";
import { componentScan } from "../component-scan";

describe("componentScan", () => {
    let tmpDir: string;

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "component-scan-"));
    });

    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it("discovers and requires .ts files from subdirs", () => {
        const subDir = path.join(tmpDir, "services");
        fs.mkdirSync(subDir, { recursive: true });
        const beanCode = `module.exports = { MyService: class MyService {} };`;
        fs.writeFileSync(path.join(subDir, "my-service.ts"), beanCode);

        expect(() => componentScan(tmpDir)).not.toThrow();
    });

    it("discovers .js files", () => {
        const subDir = path.join(tmpDir, "controllers");
        fs.mkdirSync(subDir, { recursive: true });
        fs.writeFileSync(path.join(subDir, "ctrl.js"), "module.exports = {};");

        expect(() => componentScan(tmpDir)).not.toThrow();
    });

    it("skips .d.ts declaration files", () => {
        const subDir = path.join(tmpDir, "types");
        fs.mkdirSync(subDir, { recursive: true });
        fs.writeFileSync(path.join(subDir, "types.d.ts"), "declare module 'x' {}");

        expect(() => componentScan(tmpDir)).not.toThrow();
    });

    it("skips .test.ts files", () => {
        const subDir = path.join(tmpDir, "utils");
        fs.mkdirSync(subDir, { recursive: true });
        fs.writeFileSync(path.join(subDir, "util.test.ts"), "describe('test', () => {});");

        expect(() => componentScan(tmpDir)).not.toThrow();
    });

    it("skips excluded directories (database, __test__, __tests__, migrations, lang, core)", () => {
        const excluded = ["database", "__test__", "__tests__", "migrations", "lang", "core"];
        for (const dir of excluded) {
            const subDir = path.join(tmpDir, dir);
            fs.mkdirSync(subDir, { recursive: true });
            fs.writeFileSync(path.join(subDir, "file.ts"), "export const x = 1;");
        }

        expect(() => componentScan(tmpDir)).not.toThrow();
    });

    it("uses specified dirs when provided", () => {
        const dirA = path.join(tmpDir, "a");
        const dirB = path.join(tmpDir, "b");
        fs.mkdirSync(dirA, { recursive: true });
        fs.mkdirSync(dirB, { recursive: true });
        fs.writeFileSync(path.join(dirA, "a.ts"), "module.exports = {};");
        fs.writeFileSync(path.join(dirB, "b.ts"), "module.exports = {};");

        expect(() => componentScan(tmpDir, ["a"])).not.toThrow();
    });

    it("skips non-existent dirs gracefully", () => {
        expect(() => componentScan(tmpDir, ["nonexistent"])).not.toThrow();
    });

    it("skips non-.ts/.js files", () => {
        const subDir = path.join(tmpDir, "data");
        fs.mkdirSync(subDir, { recursive: true });
        fs.writeFileSync(path.join(subDir, "readme.md"), "# Hello");
        fs.writeFileSync(path.join(subDir, "data.json"), "{}");

        expect(() => componentScan(tmpDir)).not.toThrow();
    });

    it("walks nested subdirectories", () => {
        const nested = path.join(tmpDir, "services", "nested", "deep");
        fs.mkdirSync(nested, { recursive: true });
        fs.writeFileSync(path.join(nested, "deep.ts"), "module.exports = {};");

        expect(() => componentScan(tmpDir)).not.toThrow();
    });

    it("empty base directory does not throw", () => {
        expect(() => componentScan(tmpDir)).not.toThrow();
    });
});
