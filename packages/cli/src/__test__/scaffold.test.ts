describe("SAFE_PROJECT_NAME regex", () => {
    const SAFE_PROJECT_NAME = /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/;

    it("accepts valid project names", () => {
        expect(SAFE_PROJECT_NAME.test("my-app")).toBe(true);
        expect(SAFE_PROJECT_NAME.test("my_app")).toBe(true);
        expect(SAFE_PROJECT_NAME.test("my.app")).toBe(true);
        expect(SAFE_PROJECT_NAME.test("myApp123")).toBe(true);
        expect(SAFE_PROJECT_NAME.test("app")).toBe(true);
    });

    it("rejects names starting with special characters", () => {
        expect(SAFE_PROJECT_NAME.test("-app")).toBe(false);
        expect(SAFE_PROJECT_NAME.test("_app")).toBe(false);
        expect(SAFE_PROJECT_NAME.test(".app")).toBe(false);
    });

    it("rejects names with spaces", () => {
        expect(SAFE_PROJECT_NAME.test("my app")).toBe(false);
    });

    it("rejects names with shell injection characters", () => {
        expect(SAFE_PROJECT_NAME.test("app; rm -rf /")).toBe(false);
        expect(SAFE_PROJECT_NAME.test("app$(whoami)")).toBe(false);
        expect(SAFE_PROJECT_NAME.test("app`id`")).toBe(false);
        expect(SAFE_PROJECT_NAME.test('app"test')).toBe(false);
        expect(SAFE_PROJECT_NAME.test("app'test")).toBe(false);
    });

    it("rejects empty string", () => {
        expect(SAFE_PROJECT_NAME.test("")).toBe(false);
    });
});

describe("scaffold imports", () => {
    it("uses execFileSync instead of execSync", async () => {
        const { readFileSync } = await import("fs");
        const { join } = await import("path");
        const content = readFileSync(
            join(__dirname, "../scaffold.ts"),
            "utf8"
        );
        expect(content).toContain("execFileSync");
        expect(content).not.toContain("execSync(");
    });
});

describe("getSrcFiles", () => {
    it("returns array of ProjectFile objects", async () => {
        const { getSrcFiles } = await import("../scaffold-src");
        const files = getSrcFiles();
        expect(Array.isArray(files)).toBe(true);
        expect(files.length).toBeGreaterThan(0);
    });

    it("each file has path and content", async () => {
        const { getSrcFiles } = await import("../scaffold-src");
        const files = getSrcFiles();
        for (const file of files) {
            expect(typeof file.path).toBe("string");
            expect(file.path.length).toBeGreaterThan(0);
            expect(typeof file.content).toBe("string");
        }
    });

    it("includes essential files", async () => {
        const { getSrcFiles } = await import("../scaffold-src");
        const files = getSrcFiles();
        const paths = files.map((f) => f.path);
        expect(paths).toContain("src/app.ts");
        expect(paths).toContain("src/config/env.ts");
        expect(paths).toContain("src/config/logger.ts");
        expect(paths).toContain("src/controllers/health.controller.ts");
        expect(paths).toContain("src/entities/user.entity.ts");
        expect(paths).toContain("src/services/user.service.ts");
        expect(paths).toContain("src/dto/create-user.dto.ts");
        expect(paths).toContain("src/advice/global-exception-filter.ts");
        expect(paths).toContain("src/services/user-created.listener.ts");
        expect(paths).toContain("src/database/entity-scan.ts");
        expect(paths).toContain("src/database/migrations/.gitkeep");
    });

    it("app.ts references createApplication", async () => {
        const { getSrcFiles } = await import("../scaffold-src");
        const files = getSrcFiles();
        const appTs = files.find((f) => f.path === "src/app.ts");
        expect(appTs).toBeDefined();
        expect(appTs!.content).toContain("createApplication");
    });

    it("env.ts references loadEnv", async () => {
        const { getSrcFiles } = await import("../scaffold-src");
        const files = getSrcFiles();
        const envTs = files.find((f) => f.path === "src/config/env.ts");
        expect(envTs).toBeDefined();
        expect(envTs!.content).toContain("loadEnv");
    });

    it("env.ts validates required fields", async () => {
        const { getSrcFiles } = await import("../scaffold-src");
        const files = getSrcFiles();
        const envTs = files.find((f) => f.path === "src/config/env.ts");
        expect(envTs!.content).toContain("NODE_ENV");
        expect(envTs!.content).toContain("JWT_SECRET");
        expect(envTs!.content).toContain("DB_CLIENT");
    });

    it("user.service.ts has proper imports", async () => {
        const { getSrcFiles } = await import("../scaffold-src");
        const files = getSrcFiles();
        const serviceTs = files.find((f) => f.path === "src/services/user.service.ts");
        expect(serviceTs!.content).toContain("@solumjs/core");
        expect(serviceTs!.content).toContain("hashPassword");
        expect(serviceTs!.content).toContain("ConflictException");
        expect(serviceTs!.content).toContain("NotFoundException");
    });

    it("scaffold-src.ts exports getSrcFiles function", async () => {
        const mod = await import("../scaffold-src");
        expect(typeof mod.getSrcFiles).toBe("function");
    });
});
