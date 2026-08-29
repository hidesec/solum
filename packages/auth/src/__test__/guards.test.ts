import { getPrincipal, JwtAuthGuard } from "../guards/jwt-auth.guard";
import { RolesGuard } from "../guards/roles.guard";
import { Roles } from "@solumjs/http";

describe("getPrincipal", () => {
    it("extracts user from request", () => {
        const req = { user: { sub: "u1", role: "ADMIN" } } as any;
        expect(getPrincipal(req)).toEqual({ sub: "u1", role: "ADMIN" });
    });

    it("returns undefined when no user", () => {
        const req = {} as any;
        expect(getPrincipal(req)).toBeUndefined();
    });
});

describe("JwtAuthGuard", () => {
    function createMockJwtService(verifyResult: any) {
        return { verify: jest.fn().mockReturnValue(verifyResult) };
    }

    it("rejects when no authorization header", async () => {
        const guard = new JwtAuthGuard();
        (guard as any).jwtService = createMockJwtService(null);
        const context = { request: { headers: {} } } as any;
        await expect(guard.canActivate(context)).rejects.toThrow("Missing bearer token");
    });

    it("rejects when header is not Bearer", async () => {
        const guard = new JwtAuthGuard();
        (guard as any).jwtService = createMockJwtService(null);
        const context = { request: { headers: { authorization: "Basic abc" } } } as any;
        await expect(guard.canActivate(context)).rejects.toThrow("Missing bearer token");
    });

    it("rejects when token verification fails", async () => {
        const guard = new JwtAuthGuard();
        (guard as any).jwtService = createMockJwtService(null);
        const context = { request: { headers: { authorization: "Bearer invalid" } } } as any;
        await expect(guard.canActivate(context)).rejects.toThrow("Invalid or expired token");
    });

    it("rejects when token type is not access", async () => {
        const guard = new JwtAuthGuard();
        (guard as any).jwtService = createMockJwtService({ type: "refresh" });
        const context = { request: { headers: { authorization: "Bearer token" } } } as any;
        await expect(guard.canActivate(context)).rejects.toThrow("Access token required");
    });

    it("passes and attaches user for valid access token", async () => {
        const guard = new JwtAuthGuard();
        const payload = { sub: "u1", type: "access", role: "ADMIN" };
        (guard as any).jwtService = createMockJwtService(payload);
        const req = { headers: { authorization: "Bearer valid-token" } };
        const context = { request: req } as any;
        const result = await guard.canActivate(context);
        expect(result).toBe(true);
        expect((req as any).user).toBe(payload);
    });
});

describe("RolesGuard", () => {
    it("passes when no required roles", () => {
        const guard = new RolesGuard();
        const context = {
            request: {},
            classRef: class {},
            handlerName: "noRoles",
        } as any;
        expect(guard.canActivate(context)).toBe(true);
    });

    it("throws UnauthorizedException when no principal", () => {
        const guard = new RolesGuard();
        class TestClass {
            @Roles("ADMIN")
            adminOnly() {}
        }
        const context = {
            request: {},
            classRef: TestClass,
            handlerName: "adminOnly",
        } as any;
        expect(() => guard.canActivate(context)).toThrow("Authentication required");
    });

    it("passes when user has required role", () => {
        const guard = new RolesGuard();
        class TestClass {
            adminOnly() {}
        }
        Reflect.defineMetadata("custom:roles", ["ADMIN"], TestClass, "adminOnly");
        const context = {
            request: { user: { sub: "u1", role: "ADMIN" } },
            classRef: TestClass,
            handlerName: "adminOnly",
        } as any;
        expect(guard.canActivate(context)).toBe(true);
    });

    it("throws ForbiddenException when user lacks role", () => {
        const guard = new RolesGuard();
        class TestClass {
            adminOnly() {}
        }
        Reflect.defineMetadata("custom:roles", ["ADMIN"], TestClass, "adminOnly");
        const context = {
            request: { user: { sub: "u1", role: "USER" } },
            classRef: TestClass,
            handlerName: "adminOnly",
        } as any;
        expect(() => guard.canActivate(context)).toThrow("Requires one of roles: ADMIN");
    });
});
