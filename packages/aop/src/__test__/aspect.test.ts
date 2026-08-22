import { Around, JoinPoint } from "../aspect.decorator";
import { LogExecution } from "../log-execution.decorator";

class GreetingService {
    calls: string[] = [];

    @Around(async (joinPoint: JoinPoint, proceed: () => Promise<string>) => {
        joinPoint.target.calls.push(`around:${joinPoint.className}:${joinPoint.methodName}:${JSON.stringify(joinPoint.args)}`);
        const result = await proceed();
        return `wrapped(${result})`;
    })
    async greet(name: string): Promise<string> {
        this.calls.push("original");
        return `hi ${name}`;
    }

    @Around(async (_joinPoint: JoinPoint, _proceed: () => Promise<string>) => "short-circuit")
    async neverCalled(): Promise<string> {
        throw new Error("original must not run");
    }

    @Around(async (_joinPoint: JoinPoint, proceed: () => Promise<string>) => {
        await proceed();
    })
    async boom(): Promise<string> {
        throw new Error("original-boom");
    }
}

describe("@Around", () => {
    it("menjalankan interceptor dengan joinPoint yang benar lalu hasil original", async () => {
        const service = new GreetingService();
        const result = await service.greet("solum");

        expect(result).toBe("wrapped(hi solum)");
        expect(service.calls).toEqual([
            "around:GreetingService:greet:[\"solum\"]",
            "original",
        ]);
    });

    it("interceptor bisa short-circuit tanpa memanggil original", async () => {
        const service = new GreetingService();
        await expect(service.neverCalled()).resolves.toBe("short-circuit");
    });

    it("error dari original tetap terpropagasi saat interceptor tidak menangkapnya", async () => {
        const service = new GreetingService();
        await expect(service.boom()).rejects.toThrow("original-boom");
    });
});

class LoggedService {
    @LogExecution()
    async compute(n: number): Promise<number> {
        return n * 2;
    }

    @LogExecution()
    async fail(): Promise<number> {
        throw new Error("logged-boom");
    }
}

describe("@LogExecution", () => {
    it("mengembalikan hasil original tanpa perubahan", async () => {
        const service = new LoggedService();
        await expect(service.compute(21)).resolves.toBe(42);
    });

    it("error original tetap terlempar utuh", async () => {
        const service = new LoggedService();
        await expect(service.fail()).rejects.toThrow("logged-boom");
    });
});
