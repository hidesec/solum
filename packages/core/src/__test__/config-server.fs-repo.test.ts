import fs from "fs";
import os from "os";
import path from "path";

describe("FileSystemConfigRepository.getProperties", () => {
    let tmpDir: string;
    let FileSystemConfigRepository: any;

    beforeAll(async () => {
        FileSystemConfigRepository = (await import("../config-server/index")).FileSystemConfigRepository;
    });

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "config-repo-"));
    });

    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it("returns empty object when no files exist", async () => {
        const repo = new FileSystemConfigRepository(tmpDir);
        const result = await repo.getProperties("myapp", "default", "main");
        expect(result).toEqual({});
    });

    it("reads base config file", async () => {
        fs.writeFileSync(path.join(tmpDir, "myapp.json"), JSON.stringify({ db: "postgres://localhost/mydb", port: 3000 }));
        const repo = new FileSystemConfigRepository(tmpDir);
        const result = await repo.getProperties("myapp", "default", "main");
        expect(result).toEqual({ db: "postgres://localhost/mydb", port: 3000 });
    });

    it("merges profile config over base config", async () => {
        fs.writeFileSync(path.join(tmpDir, "myapp.json"), JSON.stringify({ db: "postgres://localhost/mydb", port: 3000 }));
        fs.writeFileSync(path.join(tmpDir, "myapp-prod.json"), JSON.stringify({ db: "postgres://prod/db", debug: false }));
        const repo = new FileSystemConfigRepository(tmpDir);
        const result = await repo.getProperties("myapp", "prod", "main");
        expect(result.db).toBe("postgres://prod/db");
        expect(result.port).toBe(3000);
        expect(result.debug).toBe(false);
    });

    it("rejects invalid application name with path traversal", async () => {
        const repo = new FileSystemConfigRepository(tmpDir);
        await expect(repo.getProperties("../../../etc", "default", "main")).rejects.toThrow("Invalid application or profile name");
    });

    it("rejects invalid profile name with special characters", async () => {
        const repo = new FileSystemConfigRepository(tmpDir);
        await expect(repo.getProperties("myapp", "../etc", "main")).rejects.toThrow("Invalid application or profile name");
    });

    it("returns only base config when no profile match", async () => {
        fs.writeFileSync(path.join(tmpDir, "myapp.json"), JSON.stringify({ key: "base" }));
        const repo = new FileSystemConfigRepository(tmpDir);
        const result = await repo.getProperties("myapp", "staging", "main");
        expect(result).toEqual({ key: "base" });
    });

    it("handles multiple property keys", async () => {
        fs.writeFileSync(path.join(tmpDir, "myapp.json"), JSON.stringify({ a: 1, b: "two", c: true, d: null }));
        const repo = new FileSystemConfigRepository(tmpDir);
        const result = await repo.getProperties("myapp", "default", "main");
        expect(result.a).toBe(1);
        expect(result.b).toBe("two");
        expect(result.c).toBe(true);
        expect(result.d).toBeNull();
    });
});
