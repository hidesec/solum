import { container } from "@solumjs/core";
import { Aspect, AfterReturning, AfterThrowing, Around, Before } from "../aspect.decorator";
import type { JoinPoint } from "../aspect.decorator";
import { resetAspectInfrastructure } from "../weaver";

describe("auto-proxy pointcut via container", () => {
    beforeEach(() => {
        resetAspectInfrastructure();
        container.clear();
    });

    it("@Before dan @AfterReturning ditenun ke bean yang cocok", async () => {
        @Aspect()
        class AuditAspect {
            events: string[] = [];

            @Before("* OrderService.create*(..)")
            onCreate(jp: JoinPoint) {
                this.events.push(`before:${jp.methodName}:${jp.args[0]}`);
            }

            @AfterReturning("* OrderService.*(..)")
            onReturn(jp: JoinPoint, result: unknown) {
                this.events.push(`return:${jp.methodName}:${String(result)}`);
            }
        }
        void AuditAspect;

        class OrderService {
            create(item: string): string {
                return `ok-${item}`;
            }
            cancel(): string {
                return "cancelled";
            }
        }

        container.registerBean(OrderService, { useClass: OrderService });
        const svc = container.resolve<OrderService>(OrderService);
        await expect(svc.create("a")).resolves.toBe("ok-a");
        await expect(svc.cancel()).resolves.toBe("cancelled");

        const aspect = container.resolve<AuditAspect>(AuditAspect);
        expect(aspect.events).toEqual(["before:create:a", "return:create:ok-a", "return:cancel:cancelled"]);
    });

    it("@AfterThrowing melalui pointcut dapat memulihkan error", async () => {
        @Aspect()
        class RescueAspect {
            attempts = 0;

            @AfterThrowing("* Fragile.risky(..)")
            rescue(_jp: JoinPoint, err: unknown) {
                this.attempts++;
                void err;
                return "saved";
            }
        }
        void RescueAspect;

        class Fragile {
            risky(): string {
                throw new Error("nope");
            }
        }

        container.registerBean(Fragile, { useClass: Fragile });
        const svc = container.resolve<Fragile>(Fragile);
        await expect(svc.risky()).resolves.toBe("saved");
    });

    it("@Around lewat pointcut bisa short-circuit method target", async () => {
        @Aspect()
        class GuardAspect {
            @Around("* Vault.secret(..)")
            guard(jp: JoinPoint, _proceed: () => Promise<string>) {
                return `blocked:${jp.methodName}`;
            }
        }
        void GuardAspect;

        class Vault {
            secret(): string {
                return "treasure";
            }
            open(): string {
                return "opened";
            }
        }

        container.registerBean(Vault, { useClass: Vault });
        const vault = container.resolve<Vault>(Vault);
        await expect(vault.secret()).resolves.toBe("blocked:secret");
        expect(vault.open()).toBe("opened");
    });

    it("dua aspect berjalan sesuai urutan registrasi kelas", async () => {
        const trace: string[] = [];

        @Aspect()
        class FirstAspect {
            @Before("* T.go(..)")
            mark() {
                trace.push("first");
            }
        }
        void FirstAspect;

        @Aspect()
        class SecondAspect {
            @Before("* T.go(..)")
            mark() {
                trace.push("second");
            }
        }
        void SecondAspect;

        class T {
            go(): string {
                trace.push("core");
                return "done";
            }
        }

        container.registerBean(T, { useClass: T });
        await container.resolve<T>(T).go();
        expect(trace).toEqual(["first", "second", "core"]);
    });

    it("pola jumlah argumen dievaluasi per pemanggilan", async () => {
        @Aspect()
        class ArgsAspect {
            hits: number[] = [];

            @Before("* Tagger.tag(*)")
            hit(jp: JoinPoint) {
                this.hits.push(jp.args.length);
            }
        }
        void ArgsAspect;

        class Tagger {
            tag(...items: string[]): number {
                return items.length;
            }
        }

        container.registerBean(Tagger, { useClass: Tagger });
        const tagger = container.resolve<Tagger>(Tagger);
        expect(tagger.tag("a", "b")).toBe(2);
        await expect(tagger.tag("x")).resolves.toBe(1);

        const aspect = container.resolve<ArgsAspect>(ArgsAspect);
        expect(aspect.hits).toEqual([1]);
    });

    it("method yang tidak cocok pola tetap utuh tanpa wrapper", async () => {
        let calls = 0;

        @Aspect()
        class NarrowAspect {
            @Before("* OnlyThis.exact(..)")
            ping() {}
        }
        void NarrowAspect;

        class OnlyThis {
            exact(): string {
                calls++;
                return "exact";
            }
            other(): string {
                return "other";
            }
        }

        container.registerBean(OnlyThis, { useClass: OnlyThis });
        const descriptorBefore = Object.getOwnPropertyDescriptor(OnlyThis.prototype, "other");
        const svc = container.resolve<OnlyThis>(OnlyThis);
        const descriptorAfter = Object.getOwnPropertyDescriptor(OnlyThis.prototype, "other");

        await svc.exact();
        expect(calls).toBe(1);
        expect(typeof Object.getOwnPropertyDescriptor(OnlyThis.prototype, "exact")?.value).toBe("function");
        expect(descriptorBefore).toEqual(descriptorAfter);
    });
});
