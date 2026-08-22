import { matchesArgs, matchesPointcut, parsePointcut } from "../index";

describe("parsePointcut", () => {
    it("mem-parse bentuk execution lengkap", () => {
        const parsed = parsePointcut("execution(public * com.example.service.User*Service.save*(..))");
        expect(parsed.returnType).toBe("*");
        expect(parsed.classPattern).toBe("com.example.service.User*Service");
        expect(parsed.methodPattern).toBe("save*");
        expect(parsed.argsPattern).toBe("..");
    });

    it("mem-parse shorthand tanpa wrapper execution", () => {
        const parsed = parsePointcut("* UserService.save*(..)");
        expect(parsed.classPattern).toBe("UserService");
        expect(parsed.methodPattern).toBe("save*");
        expect(parsed.argsPattern).toBe("..");
    });

    it("shorthand tanpa return type", () => {
        const parsed = parsePointcut("OrderRepository.findById()");
        expect(parsed.returnType).toBe("*");
        expect(parsed.classPattern).toBe("OrderRepository");
        expect(parsed.methodPattern).toBe("findById");
        expect(parsed.argsPattern).toBe("");
    });

    it("menolak ekspresi tanpa tanda kurung argument", () => {
        expect(() => parsePointcut("* UserService.save")).toThrow(/Invalid pointcut/i);
    });

    it("menolak ekspresi kosong", () => {
        expect(() => parsePointcut("   ")).toThrow(/empty/i);
    });
});

describe("matchesPointcut", () => {
    it("cocok persis nama kelas dan method", () => {
        const parsed = parsePointcut("* UserService.saveUser(..)");
        expect(matchesPointcut(parsed, "UserService", "saveUser")).toBe(true);
        expect(matchesPointcut(parsed, "AdminService", "saveUser")).toBe(false);
        expect(matchesPointcut(parsed, "UserService", "deleteUser")).toBe(false);
    });

    it("wildcard pada method", () => {
        const parsed = parsePointcut("* UserService.find*(..)");
        expect(matchesPointcut(parsed, "UserService", "findById")).toBe(true);
        expect(matchesPointcut(parsed, "UserService", "findAll")).toBe(true);
        expect(matchesPointcut(parsed, "UserService", "removeById")).toBe(false);
    });

    it("wildcard pada nama kelas", () => {
        const parsed = parsePointcut("* *Service.delete*(..)");
        expect(matchesPointcut(parsed, "UserService", "deleteAll")).toBe(true);
        expect(matchesPointcut(parsed, "OrderServiceImpl", "deleteAll")).toBe(false);
    });

    it("** mencakup subpackage dan nol package", () => {
        const parsed = parsePointcut("execution(* com.app..UserService.save(..))");
        expect(matchesPointcut(parsed, "com.app.UserService", "save")).toBe(true);
        expect(matchesPointcut(parsed, "com.app.web.UserService", "save")).toBe(true);
        expect(matchesPointcut(parsed, "com.other.UserService", "save")).toBe(false);
    });

    it("** di akhir pola mencakup kedalaman apa pun", () => {
        const parsed = parsePointcut("* com.app.core..*(..)");
        expect(matchesPointcut(parsed, "com.app.core.OrderRepo", "save")).toBe(true);
        expect(matchesPointcut(parsed, "com.app.core.inner.Repo", "save")).toBe(true);
        expect(matchesPointcut(parsed, "com.app.web.Repo", "save")).toBe(false);
    });

    it("pola kelas tanpa titik tidak cocok dengan nama bertitik", () => {
        const parsed = parsePointcut("* UserService.*(..)");
        expect(matchesPointcut(parsed, "com.app.UserService", "save")).toBe(false);
    });

    it("jumlah argumen: .. bebas, () nol, (*) satu", () => {
        const anyArgs = parsePointcut("* S.doIt(..)");
        expect(matchesPointcut(anyArgs, "S", "doIt", 0)).toBe(true);
        expect(matchesPointcut(anyArgs, "S", "doIt", 3)).toBe(true);

        const none = parsePointcut("* S.doIt()");
        expect(matchesPointcut(none, "S", "doIt", 0)).toBe(true);
        expect(matchesPointcut(none, "S", "doIt", 1)).toBe(false);

        const one = parsePointcut("* S.doIt(*)");
        expect(matchesPointcut(one, "S", "doIt", 1)).toBe(true);
        expect(matchesPointcut(one, "S", "doIt", 2)).toBe(false);

        const two = parsePointcut("* S.doIt(String,String)");
        expect(matchesPointcut(two, "S", "doIt", 2)).toBe(true);
        expect(matchesPointcut(two, "S", "doIt", 1)).toBe(false);
    });

    it("matchesArgs menangani pola langsung", () => {
        expect(matchesArgs("..", 99)).toBe(true);
        expect(matchesArgs("", 0)).toBe(true);
        expect(matchesArgs("", 2)).toBe(false);
        expect(matchesArgs("*", 1)).toBe(true);
        expect(matchesArgs("A,B,C", 3)).toBe(true);
    });
});
