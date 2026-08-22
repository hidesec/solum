import { After, AfterReturning, AfterThrowing, Around, Before } from "../aspect.decorator";

const flowLog: string[] = [];

class FlowService {
    @After(async () => {
        flowLog.push("finally");
    })
    @Before(async () => {
        flowLog.push("before");
    })
    @AfterReturning(async (_jp, result) => {
        flowLog.push(`returning:${result}`);
    })
    async greet(): Promise<string> {
        flowLog.push("original");
        return "hi";
    }
}

class FailService {
    log: string[] = [];

    @Before(async (jp) => {
        (jp.target as FailService).log.push(`before:${jp.methodName}`);
    })
    @After(async (jp) => {
        (jp.target as FailService).log.push("finally");
    })
    async explode(): Promise<never> {
        throw new Error("kaput");
    }
}

const seenErrors: string[] = [];

class RethrowService {
    @AfterThrowing(async (_jp, err: Error) => {
        seenErrors.push(err.message);
    })
    async fail(): Promise<string> {
        throw new Error("boom-original");
    }
}

class RecoverService {
    @AfterThrowing(async (_jp, err: Error) => {
        void err;
        return "fallback-value";
    })
    async fail(): Promise<string> {
        throw new Error("ignored");
    }
}

class ReplaceService {
    @AfterReturning(async (_jp, result: number) => result * 100)
    async value(): Promise<number> {
        return 7;
    }
}

class MultiBeforeService {
    order: string[] = [];

    @Before(async (jp) => {
        (jp.target as MultiBeforeService).order.push("first-declared");
    })
    @Before(async (jp) => {
        (jp.target as MultiBeforeService).order.push("second-declared");
    })
    async run(): Promise<void> {}
}

describe("advice decorators mode langsung", () => {
    beforeEach(() => {
        flowLog.length = 0;
        seenErrors.length = 0;
    });

    it("urutan eksekusi before → original → after-returning → after(finally)", async () => {
        const service = new FlowService();
        await expect(service.greet()).resolves.toBe("hi");
        expect(flowLog).toEqual(["before", "original", "returning:hi", "finally"]);
    });

    it("@After tetap berjalan saat method error dan error terpropagasi", async () => {
        const service = new FailService();
        await expect(service.explode()).rejects.toThrow("kaput");
        expect(service.log).toEqual(["before:explode", "finally"]);
    });

    it("@AfterThrowing melihat error lalu melempar ulang secara default", async () => {
        const service = new RethrowService();
        await expect(service.fail()).rejects.toThrow("boom-original");
        expect(seenErrors).toEqual(["boom-original"]);
    });

    it("@AfterThrowing dapat memulihkan dengan mengembalikan nilai", async () => {
        const service = new RecoverService();
        await expect(service.fail()).resolves.toBe("fallback-value");
    });

    it("@AfterReturning bisa mengganti hasil", async () => {
        const service = new ReplaceService();
        await expect(service.value()).resolves.toBe(700);
    });

    it("beberapa @Before berjalan sesuai urutan deklarasi", async () => {
        const service = new MultiBeforeService();
        await service.run();
        expect(service.order).toEqual(["first-declared", "second-declared"]);
    });

    it("@Around tetap kompatibel di samping advice baru", async () => {
        class ComboService {
            calls: string[] = [];

            @Around(async (jp, proceed) => {
                jp.target.calls.push("around-before");
                const result = await proceed();
                jp.target.calls.push("around-after");
                return `wrapped(${result})`;
            })
            @Before(async (jp) => {
                jp.target.calls.push("advice-before");
            })
            async work(): Promise<string> {
                this.calls.push("core");
                return "done";
            }
        }

        const service = new ComboService();
        await expect(service.work()).resolves.toBe("wrapped(done)");
        expect(service.calls).toEqual(["around-before", "advice-before", "core", "around-after"]);
    });
});
