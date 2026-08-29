jest.mock("@solumjs/auth", () => ({
    verifyPassword: jest.fn(),
}));

import { verifyPassword } from "@solumjs/auth";
import { AuthService } from "../auth.service";

const mockVerifyPassword = verifyPassword as jest.MockedFunction<typeof verifyPassword>;

function createMockUserRepository(findByEmailResult: any = null, findByIdResult: any = null) {
    return {
        findByEmail: jest.fn().mockResolvedValue(findByEmailResult),
        findById: jest.fn().mockResolvedValue(findByIdResult),
    };
}

function createMockJwtService() {
    return {
        signAccessToken: jest.fn().mockReturnValue("mock-access-token"),
        signRefreshToken: jest.fn().mockReturnValue("mock-refresh-token"),
        verify: jest.fn(),
    };
}

function createMockRefreshTokenStore(markResult = true) {
    return {
        markUsedIfAbsent: jest.fn().mockReturnValue(markResult),
    };
}

describe("AuthService", () => {
    describe("login", () => {
        beforeEach(() => {
            mockVerifyPassword.mockReset();
        });

        it("returns tokens on valid credentials", async () => {
            mockVerifyPassword.mockReturnValue(true);
            const user = { id: "u1", email: "a@b.com", passwordHash: "$2b$10$realhash", role: "USER" };
            const userRepo = createMockUserRepository(user);
            const jwt = createMockJwtService();
            const refresh = createMockRefreshTokenStore();
            const service = new AuthService(userRepo as any, jwt as any, refresh as any);

            const result = await service.login({ email: "a@b.com", password: "Correct1!" } as any);
            expect(result.accessToken).toBe("mock-access-token");
            expect(result.refreshToken).toBe("mock-refresh-token");
            expect(result.tokenType).toBe("Bearer");
            expect(result.expiresIn).toBe(3600);
            expect(userRepo.findByEmail).toHaveBeenCalledWith("a@b.com");
        });

        it("normalizes email to lowercase and trimmed", async () => {
            mockVerifyPassword.mockReturnValue(true);
            const user = { id: "u1", email: "a@b.com", passwordHash: "$2b$10$realhash", role: "USER" };
            const userRepo = createMockUserRepository(user);
            const jwt = createMockJwtService();
            const refresh = createMockRefreshTokenStore();
            const service = new AuthService(userRepo as any, jwt as any, refresh as any);

            await service.login({ email: "  A@B.COM  ", password: "Correct1!" } as any);
            expect(userRepo.findByEmail).toHaveBeenCalledWith("a@b.com");
        });

        it("throws UnauthorizedException when user not found", async () => {
            mockVerifyPassword.mockReturnValue(false);
            const userRepo = createMockUserRepository(null);
            const jwt = createMockJwtService();
            const refresh = createMockRefreshTokenStore();
            const service = new AuthService(userRepo as any, jwt as any, refresh as any);

            await expect(service.login({ email: "x@y.com", password: "pass" } as any)).rejects.toThrow("Invalid email or password");
        });

        it("throws UnauthorizedException on wrong password", async () => {
            mockVerifyPassword.mockReturnValue(false);
            const user = { id: "u1", email: "a@b.com", passwordHash: "$2b$10$realhash", role: "USER" };
            const userRepo = createMockUserRepository(user);
            const jwt = createMockJwtService();
            const refresh = createMockRefreshTokenStore();
            const service = new AuthService(userRepo as any, jwt as any, refresh as any);

            await expect(service.login({ email: "a@b.com", password: "Wrong" } as any)).rejects.toThrow("Invalid email or password");
        });

        it("uses dummy hash when user not found (timing-safe)", async () => {
            mockVerifyPassword.mockReturnValue(false);
            const userRepo = createMockUserRepository(null);
            const jwt = createMockJwtService();
            const refresh = createMockRefreshTokenStore();
            const service = new AuthService(userRepo as any, jwt as any, refresh as any);

            await expect(service.login({ email: "x@y.com", password: "any" } as any)).rejects.toThrow();
            expect(mockVerifyPassword).toHaveBeenCalled();
        });
    });

    describe("refresh", () => {
        it("issues new tokens on valid refresh token", async () => {
            const user = { id: "u1", email: "a@b.com", role: "USER" };
            const userRepo = createMockUserRepository(null, user);
            const jwt = createMockJwtService();
            jwt.verify.mockReturnValue({ sub: "u1", type: "refresh", jti: "jti-1", exp: 9999999999 });
            const refresh = createMockRefreshTokenStore(true);
            const service = new AuthService(userRepo as any, jwt as any, refresh as any);

            const result = await service.refresh("valid-token");
            expect(result.accessToken).toBe("mock-access-token");
            expect(result.refreshToken).toBe("mock-refresh-token");
            expect(refresh.markUsedIfAbsent).toHaveBeenCalledWith("jti-1", expect.any(Number));
        });

        it("throws on token without type=refresh", async () => {
            const jwt = createMockJwtService();
            jwt.verify.mockReturnValue({ sub: "u1", type: "access", jti: "jti-1" });
            const refresh = createMockRefreshTokenStore();
            const service = new AuthService(createMockUserRepository() as any, jwt as any, refresh as any);

            await expect(service.refresh("bad-token")).rejects.toThrow("Invalid refresh token");
        });

        it("throws on token without jti", async () => {
            const jwt = createMockJwtService();
            jwt.verify.mockReturnValue({ sub: "u1", type: "refresh", jti: undefined });
            const refresh = createMockRefreshTokenStore();
            const service = new AuthService(createMockUserRepository() as any, jwt as any, refresh as any);

            await expect(service.refresh("bad-token")).rejects.toThrow("Invalid refresh token");
        });

        it("throws when refresh token already used", async () => {
            const jwt = createMockJwtService();
            jwt.verify.mockReturnValue({ sub: "u1", type: "refresh", jti: "used-jti", exp: 9999999999 });
            const refresh = createMockRefreshTokenStore(false);
            const service = new AuthService(createMockUserRepository() as any, jwt as any, refresh as any);

            await expect(service.refresh("used-token")).rejects.toThrow("Refresh token has already been used");
        });

        it("throws when user no longer exists", async () => {
            const userRepo = createMockUserRepository(null, null);
            const jwt = createMockJwtService();
            jwt.verify.mockReturnValue({ sub: "deleted-user", type: "refresh", jti: "jti-1", exp: 9999999999 });
            const refresh = createMockRefreshTokenStore(true);
            const service = new AuthService(userRepo as any, jwt as any, refresh as any);

            await expect(service.refresh("token")).rejects.toThrow("User no longer exists");
            expect(userRepo.findById).toHaveBeenCalledWith("deleted-user");
        });
    });
});
