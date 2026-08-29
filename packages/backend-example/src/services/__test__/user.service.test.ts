/// <reference types="jest" />
import "@solumjs/core";
import { container } from "@solumjs/core";
import { IUserRepository } from "@repositories/user.repository.interface";
import { IEventBus } from "@solumjs/events";
import { UserService } from "@services/user.service";

describe("UserService", () => {
    let mockRepo: jest.Mocked<IUserRepository>;
    let mockEventBus: jest.Mocked<IEventBus>;
    let userService: UserService;

    const executedStatements: string[] = [];

    beforeEach(() => {
        executedStatements.length = 0;

        mockRepo = {
            findById: jest.fn(),
            findByEmail: jest.fn(),
            findRecentByEmails: jest.fn(),
            findAll: jest.fn(),
            findAllById: jest.fn(),
            findPage: jest.fn(),
            existsById: jest.fn(),
            count: jest.fn(),
            save: jest.fn(),
            deleteById: jest.fn(),
            delete: jest.fn(),
        };
        mockEventBus = {
            publish: jest.fn().mockResolvedValue(undefined),
        };

        container.register("DatabaseDriver", {
            useValue: {
                clientName: "postgres",
                query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
                transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
                    executedStatements.push("BEGIN");
                    try {
                        const result = await fn({
                            query: jest.fn(async (sql: string) => {
                                executedStatements.push(sql);
                                return { rows: [], rowCount: 0 };
                            }),
                        });
                        executedStatements.push("COMMIT");
                        return result;
                    } catch (err) {
                        executedStatements.push("ROLLBACK");
                        throw err;
                    }
                }),
            },
        });

        userService = new UserService(mockRepo, mockEventBus);
    });

    it("should create a new user", async () => {
        const dto = { name: "John Doe", email: "john.doe@example.com", password: "Str0ng!Pass" };
        const user = { id: "1", name: "John Doe", email: "john.doe@example.com", role: "USER", createdAt: new Date() };
        mockRepo.save.mockResolvedValueOnce(user);

        const result = await userService.createUser(dto);
        expect(result.name).toBe(dto.name);
        expect(result.email).toBe(dto.email);
        expect(mockRepo.save).toHaveBeenCalledTimes(1);
        expect(mockEventBus.publish).toHaveBeenCalledWith("USER_CREATED", {
            userId: "1",
            email: "john.doe@example.com",
        });
        expect(executedStatements).toContain("BEGIN");
        expect(executedStatements).toContain("COMMIT");
    });

    it("should throw ConflictException when creating user with duplicate email", async () => {
        const dto = { name: "Dup", email: "dup@test.com", password: "Pass123!" };
        mockRepo.findByEmail.mockResolvedValueOnce({ id: "existing" } as any);

        await expect(userService.createUser(dto)).rejects.toThrow("already registered");
    });

    it("should throw NotFound when deleting missing user", async () => {
        mockRepo.findById.mockResolvedValueOnce(null);

        await expect(userService.deleteUser("missing-id")).rejects.toThrow("User with id missing-id not found");
        expect(mockRepo.deleteById).not.toHaveBeenCalled();
        expect(executedStatements).toContain("ROLLBACK");
    });

    it("should delete existing user successfully", async () => {
        const user = { id: "del-1", name: "Del", email: "del@test.com", role: "USER", createdAt: new Date() };
        mockRepo.findById.mockResolvedValueOnce(user as any);
        mockRepo.deleteById.mockResolvedValueOnce(undefined as any);

        await expect(userService.deleteUser("del-1")).resolves.toBeUndefined();
        expect(mockRepo.deleteById).toHaveBeenCalledWith("del-1");
        expect(executedStatements).toContain("BEGIN");
        expect(executedStatements).toContain("COMMIT");
    });

    it("should getUserById return user when found", async () => {
        const user = { id: "u1", name: "Test", email: "test@test.com", role: "USER", createdAt: new Date() };
        mockRepo.findById.mockResolvedValueOnce(user as any);

        const result = await userService.getUserById("u1");
        expect(result).toEqual(user);
    });

    it("should getUserById throw NotFoundException when not found", async () => {
        mockRepo.findById.mockResolvedValueOnce(null);

        await expect(userService.getUserById("nonexistent")).rejects.toThrow("not found");
    });

    it("should findRecentByEmails call repository", async () => {
        const users = [{ id: "1", email: "a@test.com", name: "A", role: "USER", createdAt: new Date() }];
        mockRepo.findRecentByEmails.mockResolvedValueOnce(users as any);

        const result = await userService.findRecentByEmails(["a@test.com"], 10);
        expect(result).toEqual(users);
        expect(mockRepo.findRecentByEmails).toHaveBeenCalledWith(["a@test.com"], 10);
    });

    it("should findRecentByEmails throw BadRequestException for empty emails", async () => {
        await expect(userService.findRecentByEmails([], 10)).rejects.toThrow("emails must not be empty");
    });

    it("should findPage call repository", async () => {
        const { PageRequest } = require("@solumjs/http");
        const pageReq = PageRequest.of(1, 10);
        const page = { items: [], total: 0, page: 1, size: 10 };
        mockRepo.findPage.mockResolvedValueOnce(page as any);

        const result = await userService.findPage(pageReq);
        expect(result).toEqual(page);
    });

    it("should updateRole throw NotFoundException when user not found", async () => {
        mockRepo.findById.mockResolvedValueOnce(null);

        await expect(userService.updateRole("missing", "ADMIN" as any)).rejects.toThrow("not found");
    });

    it("should updateRole save and return updated user", async () => {
        const user = { id: "u2", name: "Role", email: "role@test.com", role: "USER", createdAt: new Date() };
        mockRepo.findById.mockResolvedValueOnce(user as any);
        const updatedUser = { ...user, role: "ADMIN" };
        mockRepo.save.mockResolvedValueOnce(updatedUser as any);

        const result = await userService.updateRole("u2", "ADMIN" as any);
        expect(result.role).toBe("ADMIN");
        expect(mockRepo.save).toHaveBeenCalled();
    });

    it("should init log on PostConstruct", () => {
        expect(() => userService.init()).not.toThrow();
    });
});
