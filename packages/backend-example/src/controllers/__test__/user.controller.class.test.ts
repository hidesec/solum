import { UserController } from "../user.controller";

function createMockUserService(overrides: Record<string, any> = {}) {
    return {
        createUser: jest.fn().mockResolvedValue({ id: "u1", email: "a@b.com", name: "Test", role: "USER" }),
        getUserById: jest.fn().mockResolvedValue({ id: "u1", email: "a@b.com", name: "Test", role: "USER" }),
        findRecentByEmails: jest.fn().mockResolvedValue([]),
        findPage: jest.fn().mockResolvedValue({ content: [], total: 0, page: 1, size: 10 }),
        deleteUser: jest.fn().mockResolvedValue(undefined),
        updateRole: jest.fn().mockResolvedValue({ id: "u1", email: "a@b.com", name: "Test", role: "ADMIN" }),
        ...overrides,
    };
}

function createMockReq(overrides: Record<string, any> = {}) {
    return {
        raw: { socket: { remoteAddress: "127.0.0.1" } },
        path: "/users",
        log: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
        ...overrides,
    } as any;
}

function createMockRes() {
    let _status = 200;
    let _body: any;
    const res = {
        status(code: number) { _status = code; return res; },
        json(data: any) { _body = data; return res; },
        _getStatus: () => _status,
        _getBody: () => _body,
    } as any;
    return res;
}

describe("UserController", () => {
    describe("createUser", () => {
        it("creates user and returns UserResponseDto", async () => {
            const user = { id: "u1", email: "a@b.com", name: "Test", role: "USER" };
            const userService = createMockUserService({ createUser: jest.fn().mockResolvedValue(user) });
            const controller = new UserController();
            (controller as any).userService = userService;

            const req = createMockReq();
            const res = createMockRes();
            const result = await controller.createUser({ email: "a@b.com", name: "Test", password: "Pass123!" } as any, req);

            expect(userService.createUser).toHaveBeenCalled();
            expect(result).toBeDefined();
        });
    });

    describe("getUserById", () => {
        it("returns own profile for same user", async () => {
            const user = { id: "u1", email: "a@b.com", name: "Test", role: "USER" };
            const userService = createMockUserService({ getUserById: jest.fn().mockResolvedValue(user) });
            const controller = new UserController();
            (controller as any).userService = userService;

            const req = createMockReq();
            const result = await controller.getUserById("u1", { sub: "u1", role: "USER" } as any, req);
            expect(result).toBeDefined();
        });

        it("allows ADMIN to access other profiles", async () => {
            const user = { id: "u2", email: "b@b.com", name: "Other", role: "USER" };
            const userService = createMockUserService({ getUserById: jest.fn().mockResolvedValue(user) });
            const controller = new UserController();
            (controller as any).userService = userService;

            const req = createMockReq();
            const result = await controller.getUserById("u2", { sub: "admin-1", role: "ADMIN" } as any, req);
            expect(result).toBeDefined();
        });

        it("blocks USER from accessing other profiles", async () => {
            const userService = createMockUserService();
            const controller = new UserController();
            (controller as any).userService = userService;

            const req = createMockReq();
            await expect(controller.getUserById("u2", { sub: "u1", role: "USER" } as any, req)).rejects.toThrow("You can only access your own profile");
        });
    });

    describe("findRecentByEmails", () => {
        it("parses comma-separated emails and returns results", async () => {
            const userService = createMockUserService({
                findRecentByEmails: jest.fn().mockResolvedValue([
                    { id: "u1", email: "a@b.com", name: "A", role: "USER" },
                ]),
            });
            const controller = new UserController();
            (controller as any).userService = userService;

            const req = createMockReq();
            const result = await controller.findRecentByEmails("a@b.com, b@b.com", "10", req);
            expect(userService.findRecentByEmails).toHaveBeenCalledWith(["a@b.com", "b@b.com"], 10);
            expect(result).toBeDefined();
        });

        it("throws on empty emails", async () => {
            const userService = createMockUserService();
            const controller = new UserController();
            (controller as any).userService = userService;

            const req = createMockReq();
            await expect(controller.findRecentByEmails("", "10", req)).rejects.toThrow("Query param 'emails' is required");
        });

        it("filters empty entries from email list", async () => {
            const userService = createMockUserService({
                findRecentByEmails: jest.fn().mockResolvedValue([]),
            });
            const controller = new UserController();
            (controller as any).userService = userService;

            const req = createMockReq();
            await controller.findRecentByEmails("a@b.com,, , c@b.com", "10", req);
            expect(userService.findRecentByEmails).toHaveBeenCalledWith(["a@b.com", "c@b.com"], 10);
        });

        it("clamps limit to 1-100 range", async () => {
            const userService = createMockUserService({
                findRecentByEmails: jest.fn().mockResolvedValue([]),
            });
            const controller = new UserController();
            (controller as any).userService = userService;

            const req = createMockReq();
            await controller.findRecentByEmails("a@b.com", "200", req);
            expect(userService.findRecentByEmails).toHaveBeenCalledWith(["a@b.com"], 100);
        });
    });

    describe("deleteUser", () => {
        it("deletes user and returns success", async () => {
            const userService = createMockUserService();
            const controller = new UserController();
            (controller as any).userService = userService;

            const req = createMockReq();
            const result = await controller.deleteUser("u1", req);
            expect(userService.deleteUser).toHaveBeenCalledWith("u1");
            expect(result.status).toBe("success");
        });
    });

    describe("updateRole", () => {
        it("updates role for another user", async () => {
            const userService = createMockUserService({
                updateRole: jest.fn().mockResolvedValue({ id: "u1", email: "a@b.com", name: "Test", role: "ADMIN" }),
            });
            const controller = new UserController();
            (controller as any).userService = userService;

            const req = createMockReq();
            const result = await controller.updateRole("u1", { role: "ADMIN" } as any, { sub: "admin-1", role: "ADMIN" } as any, req);
            expect(userService.updateRole).toHaveBeenCalledWith("u1", "ADMIN");
            expect(result).toBeDefined();
        });

        it("blocks self-role-change", async () => {
            const userService = createMockUserService();
            const controller = new UserController();
            (controller as any).userService = userService;

            const req = createMockReq();
            await expect(controller.updateRole("u1", { role: "ADMIN" } as any, { sub: "u1", role: "ADMIN" } as any, req)).rejects.toThrow("Cannot change your own role");
        });
    });

    describe("me", () => {
        it("returns current user profile", async () => {
            const user = { id: "u1", email: "a@b.com", name: "Test", role: "USER" };
            const userService = createMockUserService({ getUserById: jest.fn().mockResolvedValue(user) });
            const controller = new UserController();
            (controller as any).userService = userService;

            const req = createMockReq();
            const result = await controller.me({ sub: "u1", role: "USER" } as any, req);
            expect(userService.getUserById).toHaveBeenCalledWith("u1");
            expect(result).toBeDefined();
        });
    });

    describe("listUsers", () => {
        it("returns paginated users", async () => {
            const pageResult = {
                content: [
                    { id: "u1", email: "a@b.com", name: "A", role: "USER" },
                ],
                total: 1,
                page: 1,
                size: 10,
            };
            const userService = createMockUserService({ findPage: jest.fn().mockResolvedValue(pageResult) });
            const controller = new UserController();
            (controller as any).userService = userService;

            const req = createMockReq();
            const result = await controller.listUsers({ page: "1", size: "10" } as any, req);
            expect(result).toBeDefined();
            expect(result.content).toHaveLength(1);
        });
    });

    describe("handleDuplicateEmail", () => {
        it("returns error response for ConflictException", () => {
            const controller = new UserController();
            const req = createMockReq();
            const result = controller.handleDuplicateEmail({ message: "Duplicate email" } as any, req);
            expect(result.status).toBe("error");
            expect(result.code).toBe("USER_EMAIL_CONFLICT");
        });
    });
});
