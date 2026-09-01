import { container } from "@solumjs/core";
import { Auditable } from "../auditable.decorator";
import { Aspect } from "../aspect.decorator";
import { Around } from "../aspect.decorator";

describe("Auditable", () => {
    afterEach(() => container.clear());

    it("logs audit info when decorated method is called", async () => {
        const mockLogger = {
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
            debug: jest.fn(),
            child: jest.fn().mockReturnThis(),
        };
        const { setFrameworkLogger } = require("@solumjs/core");
        setFrameworkLogger(mockLogger);

        class UserService {
            @Auditable("create-user")
            async createUser(name: string) {
                return { id: 1, name };
            }
        }

        const service = new UserService();
        const result = await service.createUser("Alice");

        expect(result).toEqual({ id: 1, name: "Alice" });
        expect(mockLogger.info).toHaveBeenCalledWith(
            expect.objectContaining({ audit: true, action: "create-user" }),
            expect.stringContaining("AUDIT: create-user")
        );

        setFrameworkLogger(require("@solumjs/core").getFrameworkLogger());
    });

    it("returns the original result", async () => {
        class SimpleService {
            @Auditable("test-action")
            compute(x: number) {
                return x * 2;
            }
        }

        const service = new SimpleService();
        expect(await service.compute(5)).toBe(10);
    });

    it("propagates errors from the original method", async () => {
        class FailingService {
            @Auditable("failing-action")
            fail() {
                throw new Error("boom");
            }
        }

        const service = new FailingService();
        await expect(service.fail()).rejects.toThrow("boom");
    });
});
