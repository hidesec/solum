import "@solumjs/core";
import { evaluateExpression, getPreAuthorizeExpression } from "../expression-evaluator";
import { JwtPayload } from "../jwt.service.interface";

const adminPrincipal: JwtPayload = {
    sub: "u1",
    email: "admin@example.com",
    role: "ADMIN",
    type: "access",
};

const userPrincipal: JwtPayload = {
    sub: "u2",
    email: "user@example.com",
    role: "USER",
    type: "access",
};

describe("evaluateExpression", () => {
    describe("hasRole", () => {
        it("returns true when role matches", () => {
            expect(evaluateExpression("hasRole('ADMIN')", adminPrincipal)).toBe(true);
        });

        it("returns false when role does not match", () => {
            expect(evaluateExpression("hasRole('ADMIN')", userPrincipal)).toBe(false);
        });

        it("returns false when principal is undefined", () => {
            expect(evaluateExpression("hasRole('ADMIN')", undefined)).toBe(false);
        });
    });

    describe("hasAnyRole", () => {
        it("returns true when role is in the list", () => {
            expect(evaluateExpression("hasAnyRole('ADMIN','MANAGER')", adminPrincipal)).toBe(true);
        });

        it("returns false when role is not in the list", () => {
            expect(evaluateExpression("hasAnyRole('MANAGER','GUEST')", adminPrincipal)).toBe(false);
        });

        it("returns false when principal is undefined", () => {
            expect(evaluateExpression("hasAnyRole('ADMIN')", undefined)).toBe(false);
        });
    });

    describe("isAuthenticated", () => {
        it("returns true when principal exists", () => {
            expect(evaluateExpression("isAuthenticated()", adminPrincipal)).toBe(true);
        });

        it("returns false when principal is undefined", () => {
            expect(evaluateExpression("isAuthenticated()", undefined)).toBe(false);
        });
    });

    describe("negation", () => {
        it("negates hasRole", () => {
            expect(evaluateExpression("!hasRole('ADMIN')", adminPrincipal)).toBe(false);
            expect(evaluateExpression("!hasRole('ADMIN')", userPrincipal)).toBe(true);
        });

        it("negates isAuthenticated", () => {
            expect(evaluateExpression("!isAuthenticated()", adminPrincipal)).toBe(false);
            expect(evaluateExpression("!isAuthenticated()", undefined)).toBe(true);
        });

        it("negates hasAnyRole", () => {
            expect(evaluateExpression("!hasAnyRole('ADMIN','MANAGER')", adminPrincipal)).toBe(false);
            expect(evaluateExpression("!hasAnyRole('ADMIN','MANAGER')", userPrincipal)).toBe(true);
        });
    });

    describe("error handling", () => {
        it("throws on invalid expression format", () => {
            expect(() => evaluateExpression("invalid", adminPrincipal)).toThrow("Invalid security expression");
        });

        it("throws on unknown function", () => {
            expect(() => evaluateExpression("unknownFunc('X')", adminPrincipal)).toThrow("Unknown security function");
        });
    });
});

describe("getPreAuthorizeExpression", () => {
    const META_KEY = "custom:pre-authorize";

    class Target {}
    class OtherTarget {}

    it("returns method-level expression when present", () => {
        Reflect.defineMetadata(META_KEY, "hasRole('ADMIN')", Target, "delete");
        expect(getPreAuthorizeExpression(Target, "delete")).toBe("hasRole('ADMIN')");
    });

    it("returns class-level expression when no method-level", () => {
        Reflect.defineMetadata(META_KEY, "isAuthenticated()", OtherTarget);
        expect(getPreAuthorizeExpression(OtherTarget, "anyMethod")).toBe("isAuthenticated()");
    });

    it("method-level takes priority over class-level", () => {
        class PriorityTarget {}
        Reflect.defineMetadata(META_KEY, "isAuthenticated()", PriorityTarget);
        Reflect.defineMetadata(META_KEY, "hasRole('ADMIN')", PriorityTarget, "delete");
        expect(getPreAuthorizeExpression(PriorityTarget, "delete")).toBe("hasRole('ADMIN')");
    });

    it("returns undefined when no expression is set", () => {
        class FreshTarget {}
        expect(getPreAuthorizeExpression(FreshTarget, "anyMethod")).toBeUndefined();
    });
});
