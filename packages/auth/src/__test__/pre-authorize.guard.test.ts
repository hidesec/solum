import { ForbiddenException } from "@solumjs/core";
import { ExpressionGuard } from "../pre-authorize.guard";
import { getPreAuthorizeExpression } from "../expression-evaluator";
import { ExecutionContext } from "@solumjs/http";
import { JwtPayload } from "../jwt.service.interface";

jest.mock("../expression-evaluator", () => {
    const actual = jest.requireActual("../expression-evaluator");
    return {
        ...actual,
        getPreAuthorizeExpression: jest.fn(),
    };
});

const mockGetPreAuthorizeExpression = getPreAuthorizeExpression as jest.MockedFunction<typeof getPreAuthorizeExpression>;

function makeContext(user?: JwtPayload, expression?: string): ExecutionContext {
    const classRef = class TestController {};
    const handlerName = "testMethod";

    mockGetPreAuthorizeExpression.mockReturnValue(expression);

    return {
        classRef,
        handlerName,
        request: {
            method: "GET",
            path: "/test",
            params: {},
            query: {},
            headers: {},
            body: undefined,
            log: { info: () => {}, warn: () => {}, error: () => {} },
            raw: {} as any,
            user,
        } as any,
        response: {} as any,
    };
}

describe("ExpressionGuard", () => {
    let guard: ExpressionGuard;

    beforeEach(() => {
        guard = new ExpressionGuard();
        jest.clearAllMocks();
    });

    it("allows access when no expression is set", () => {
        const ctx = makeContext(undefined, undefined);
        expect(guard.canActivate(ctx)).toBe(true);
    });

    it("allows access when expression evaluates to true", () => {
        const ctx = makeContext(
            { sub: "1", email: "a@b.com", role: "ADMIN", type: "access" },
            "hasRole('ADMIN')"
        );
        expect(guard.canActivate(ctx)).toBe(true);
    });

    it("throws ForbiddenException when expression evaluates to false", () => {
        const ctx = makeContext(
            { sub: "1", email: "a@b.com", role: "USER", type: "access" },
            "hasRole('ADMIN')"
        );
        expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
    });

    it("includes expression in error message", () => {
        const ctx = makeContext(
            { sub: "1", email: "a@b.com", role: "USER", type: "access" },
            "hasRole('ADMIN')"
        );
        expect(() => guard.canActivate(ctx)).toThrow('hasRole(\'ADMIN\')');
    });

    it("allows negated expression when condition is met", () => {
        const ctx = makeContext(
            { sub: "1", email: "a@b.com", role: "USER", type: "access" },
            "!hasRole('ADMIN')"
        );
        expect(guard.canActivate(ctx)).toBe(true);
    });

    it("denies negated expression when condition is not met", () => {
        const ctx = makeContext(
            { sub: "1", email: "a@b.com", role: "ADMIN", type: "access" },
            "!hasRole('ADMIN')"
        );
        expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
    });

    it("handles isAuthenticated() with principal present", () => {
        const ctx = makeContext(
            { sub: "1", email: "a@b.com", role: "USER", type: "access" },
            "isAuthenticated()"
        );
        expect(guard.canActivate(ctx)).toBe(true);
    });

    it("denies isAuthenticated() when no principal", () => {
        const ctx = makeContext(undefined, "isAuthenticated()");
        expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
    });
});
