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

    it("should throw NotFound when deleting missing user", async () => {
        mockRepo.findById.mockResolvedValueOnce(null);

        await expect(userService.deleteUser("missing-id")).rejects.toThrow("User with id missing-id not found");
        expect(mockRepo.deleteById).not.toHaveBeenCalled();
        expect(executedStatements).toContain("ROLLBACK");
    });
});
