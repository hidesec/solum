import { toPascalCase, toKebabCase, generateTemplates, getRootFiles } from "../generate";

describe("toPascalCase", () => {
    it("converts kebab-case", () => {
        expect(toPascalCase("user-profile")).toBe("UserProfile");
    });

    it("converts snake_case", () => {
        expect(toPascalCase("user_profile")).toBe("UserProfile");
    });

    it("converts single word", () => {
        expect(toPascalCase("user")).toBe("User");
    });

    it("handles multi-word", () => {
        expect(toPascalCase("my-cool-service")).toBe("MyCoolService");
    });

    it("handles already PascalCase", () => {
        expect(toPascalCase("UserProfile")).toBe("UserProfile");
    });
});

describe("toKebabCase", () => {
    it("converts PascalCase", () => {
        expect(toKebabCase("UserProfile")).toBe("user-profile");
    });

    it("converts camelCase", () => {
        expect(toKebabCase("userProfile")).toBe("user-profile");
    });

    it("converts spaces", () => {
        expect(toKebabCase("User Profile")).toBe("user-profile");
    });

    it("converts snake_case", () => {
        expect(toKebabCase("user_profile")).toBe("user-profile");
    });

    it("handles single word", () => {
        expect(toKebabCase("user")).toBe("user");
    });
});

describe("generateTemplates", () => {
    it("has templates for all standard types", () => {
        const types = ["controller", "service", "repository", "entity", "dto", "middleware", "guard", "listener", "filter"];
        for (const type of types) {
            expect(generateTemplates[type]).toBeDefined();
            expect(typeof generateTemplates[type]).toBe("function");
        }
    });

    it("controller template generates valid content", () => {
        const template = generateTemplates.controller("user");
        expect(template.dir).toBe("controllers");
        expect(template.name).toBe("user.controller.ts");
        expect(template.content).toContain("RestController");
        expect(template.content).toContain("UserController");
    });

    it("service template generates valid content", () => {
        const template = generateTemplates.service("order");
        expect(template.dir).toBe("services");
        expect(template.name).toBe("order.service.ts");
        expect(template.content).toContain("Bean");
        expect(template.content).toContain("OrderService");
    });

    it("entity template generates valid content", () => {
        const template = generateTemplates.entity("product");
        expect(template.dir).toBe("entities");
        expect(template.name).toBe("product.entity.ts");
        expect(template.content).toContain("Entity");
        expect(template.content).toContain("Product");
    });

    it("dto template generates valid content", () => {
        const template = generateTemplates.dto("create-item");
        expect(template.dir).toBe("dto");
        expect(template.name).toBe("create-item.dto.ts");
    });

    it("guard template generates valid content", () => {
        const template = generateTemplates.guard("admin");
        expect(template.dir).toBe("guards");
        expect(template.name).toBe("admin.guard.ts");
        expect(template.content).toContain("CanActivate");
    });

    it("middleware template generates valid content", () => {
        const template = generateTemplates.middleware("rate-limit");
        expect(template.dir).toBe("middlewares");
        expect(template.name).toBe("rate-limit.middleware.ts");
    });

    it("listener template generates valid content", () => {
        const template = generateTemplates.listener("user-created");
        expect(template.dir).toBe("listeners");
        expect(template.name).toBe("user-created.listener.ts");
        expect(template.content).toContain("EventListener");
    });

    it("filter template generates valid content", () => {
        const template = generateTemplates.filter("exception");
        expect(template.dir).toBe("filters");
        expect(template.name).toBe("exception.filter.ts");
    });

    it("repository template generates valid content", () => {
        const template = generateTemplates.repository("user");
        expect(template.dir).toBe("repositories");
        expect(template.name).toBe("user.repository.ts");
        expect(template.content).toContain("BaseRepository");
    });
});

describe("getRootFiles", () => {
    it("returns array of project files", () => {
        const files = getRootFiles("my-app");
        expect(Array.isArray(files)).toBe(true);
        expect(files.length).toBeGreaterThan(0);
    });

    it("includes package.json", () => {
        const files = getRootFiles("test-pkg");
        const pkg = files.find((f) => f.path === "package.json");
        expect(pkg).toBeDefined();
        expect(JSON.parse(pkg!.content).name).toBe("test-pkg");
    });

    it("includes tsconfig.json", () => {
        const files = getRootFiles("test-pkg");
        const tsconfig = files.find((f) => f.path === "tsconfig.json");
        expect(tsconfig).toBeDefined();
        expect(JSON.parse(tsconfig!.content).compilerOptions).toBeDefined();
    });

    it("includes jest.config.js", () => {
        const files = getRootFiles("test-pkg");
        const jest = files.find((f) => f.path === "jest.config.js");
        expect(jest).toBeDefined();
        expect(jest!.content).toContain("ts-jest");
    });

    it("includes prod-paths.js", () => {
        const files = getRootFiles("test-pkg");
        const prod = files.find((f) => f.path === "prod-paths.js");
        expect(prod).toBeDefined();
    });

    it("includes .env.example", () => {
        const files = getRootFiles("test-pkg");
        const env = files.find((f) => f.path === ".env.example");
        expect(env).toBeDefined();
        expect(env!.content).toContain("DB_CLIENT=postgres");
    });

    it("includes .gitignore", () => {
        const files = getRootFiles("test-pkg");
        const gitignore = files.find((f) => f.path === ".gitignore");
        expect(gitignore).toBeDefined();
        expect(gitignore!.content).toContain("node_modules/");
    });

    it("env example uses provided package name", () => {
        const files = getRootFiles("my-project");
        const env = files.find((f) => f.path === ".env.example");
        expect(env!.content).toContain("DB_NAME=my-project");
    });
});
