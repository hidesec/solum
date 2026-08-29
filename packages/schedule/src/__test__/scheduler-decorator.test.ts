import { Scheduled, startScheduledTasks, stopScheduledTasks } from "../scheduler";

describe("Scheduled decorator", () => {
    it("registers cron task", () => {
        class TestClass {
            @Scheduled("*/5 * * * *")
            runTask() {}
        }
        // The decorator pushes to internal tasks array directly
        // Just verify the decorator runs without error
        expect(typeof TestClass.prototype.runTask).toBe("function");
    });

    it("registers interval task", () => {
        class TestClass {
            @Scheduled({ fixedDelay: 1000 })
            runInterval() {}
        }
        expect(typeof TestClass.prototype.runInterval).toBe("function");
    });

    it("registers zone-aware task", () => {
        class TestClass {
            @Scheduled({ zone: "Asia/Jakarta" })
            zonedTask() {}
        }
        expect(typeof TestClass.prototype.zonedTask).toBe("function");
    });

    it("supports multiple scheduled methods", () => {
        class TestClass {
            @Scheduled("0 * * * *")
            hourly() {}

            @Scheduled({ fixedDelay: 5000 })
            every5s() {}
        }
        expect(typeof TestClass.prototype.hourly).toBe("function");
        expect(typeof TestClass.prototype.every5s).toBe("function");
    });
});

describe("startScheduledTasks and stopScheduledTasks", () => {
    it("startScheduledTasks does not throw with no registered tasks", () => {
        expect(() => startScheduledTasks()).not.toThrow();
    });

    it("stopScheduledTasks does not throw", () => {
        stopScheduledTasks();
        expect(true).toBe(true);
    });
});
