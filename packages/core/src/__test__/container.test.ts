import {
    Bean,
    ConditionalOnProperty,
    Lazy,
    Order,
    PostConstruct,
    Primary,
    Profile,
    Qualifier,
    Scope,
    container,
    inject,
    injectAll,
    resolve,
    runWithRequestContext,
    registerBeanPostProcessor,
    registerBeanFactoryPostProcessor,
} from "../index";
import { ConfigPort, setFrameworkConfig } from "../index";

interface NamedHandler {
    tag(): string;
}

const fakeConfig: ConfigPort = {
    get: (key) => ({ FEATURE_ON: "true" }[key]),
    getNumber: () => undefined,
    getBoolean: () => undefined,
};

describe("container: scope", () => {
    beforeEach(() => container.clear());

    it("singleton adalah default dan di-cache", () => {
        @Bean()
        class SingletonBean {}

        const a = resolve(SingletonBean);
        const b = resolve(SingletonBean);
        expect(a).toBe(b);
    });

    it("@Scope(prototype) menghasilkan instance baru setiap resolve", () => {
        let counter = 0;

        @Bean()
        @Scope("prototype")
        class ProtoBean {
            readonly seq = ++counter;
        }

        expect(resolve<ProtoBean>(ProtoBean).seq).toBe(1);
        expect(resolve<ProtoBean>(ProtoBean).seq).toBe(2);
    });

    it("request scope: error di luar konteks, konsisten di dalam, terisolasi antar request", () => {
        @Bean("ReqSvc")
        @Scope("request")
        class ReqSvc {}

        expect(() => resolve("ReqSvc")).toThrow(/request/i);

        runWithRequestContext(() => {
            const a = resolve<ReqSvc>("ReqSvc");
            const b = resolve<ReqSvc>("ReqSvc");
            expect(a).toBe(b);
        });

        runWithRequestContext(() => {
            const c = resolve<ReqSvc>("ReqSvc");
            runWithRequestContext(() => {
                const d = resolve<ReqSvc>("ReqSvc");
                expect(c === d).toBe(false);
            });
        });
    });
});

describe("container: kandidat & qualifier", () => {
    beforeEach(() => {
        container.clear();
        setFrameworkConfig(fakeConfig);
    });

    interface PayCandidate extends NamedHandler {}

    function registerPayCandidates(): void {
        @Bean("Pay")
        @Qualifier("paypal")
        class Paypal implements PayCandidate {
            tag() {
                return "paypal";
            }
        }

        @Bean("Pay")
        @Qualifier("stripe")
        class Stripe implements PayCandidate {
            tag() {
                return "stripe";
            }
        }
    }

    it("@Qualifier memilih kandidat berdasar nama", () => {
        registerPayCandidates();
        expect(resolve<NamedHandler>("Pay", { qualifier: "stripe" }).tag()).toBe("stripe");
        expect(resolve<NamedHandler>("Pay", { qualifier: "paypal" }).tag()).toBe("paypal");
    });

    it("qualifier tak dikenal melempar error berisi daftar kandidat", () => {
        registerPayCandidates();
        expect(() => resolve("Pay", { qualifier: "gopay" })).toThrow(/paypal/);
    });

    it("kandidat ganda tanpa qualifier dan tanpa primary = ambigu", () => {
        registerPayCandidates();
        expect(() => resolve("Pay")).toThrow(/Multiple beans for token/);
    });

    it("@Primary menang di antara banyak kandidat", () => {
        @Bean("Pay2")
        @Qualifier("fallback")
        class FallbackPay implements NamedHandler {
            tag() {
                return "fallback";
            }
        }

        @Bean("Pay2")
        @Primary()
        class PrimaryPay implements NamedHandler {
            tag() {
                return "primary";
            }
        }

        expect(resolve<NamedHandler>("Pay2").tag()).toBe("primary");
    });

    it("injectAll mengumpulkan semua kandidat aktif urut @Order", () => {
        @Bean("IHandler")
        @Order(3)
        class EmailHandler implements NamedHandler {
            tag() {
                return "email";
            }
        }

        @Bean("IHandler")
        @Order(1)
        class SmsHandler implements NamedHandler {
            tag() {
                return "sms";
            }
        }

        @Bean("IHandler")
        @Profile("__never_active__")
        class HiddenHandler implements NamedHandler {
            tag() {
                return "hidden";
            }
        }

        class Consumer {
            constructor(@injectAll("IHandler") public handlers: NamedHandler[]) {}
        }

        const consumer = resolve<Consumer>(Consumer);
        expect(consumer.handlers.map((h) => h.tag())).toEqual(["sms", "email"]);
    });

    it("inject dengan lazy option mengembalikan proxy yang baru dibangun saat dipakai", async () => {
        let built = 0;

        @Bean("LazyDep")
        class LazyDep {
            constructor() {
                built++;
            }
            ping() {
                return "pong";
            }
        }

        class Holder {
            constructor(@inject("LazyDep", { lazy: true }) public dep: LazyDep) {}
        }

        const holder = resolve<Holder>(Holder);
        expect(built).toBe(0);
        expect(holder.dep.ping()).toBe("pong");
        expect(built).toBe(1);
    });
});

describe("container: circular dependency", () => {
    beforeEach(() => container.clear());

    it("A↔B lewat constructor injection tetap selesai; kolaborator menerima proxy yang siap saat runtime", async () => {
        @Bean("SvcA")
        class SvcA {
            constructor(@inject("SvcB") public b: any) {}
            name() {
                return "A";
            }
        }

        @Bean("SvcB")
        class SvcB {
            constructor(@inject("SvcA") public a: any) {}
            who() {
                return `B->${this.a.name()}`;
            }
        }

        const a = resolve<SvcA>("SvcA");
        await Promise.resolve();

        const b = resolve<SvcB>("SvcB");
        expect(a.b.who()).toBe("B->A");
        expect(b.a.name()).toBe("A");
    });
});

describe("@Lazy", () => {
    beforeEach(() => container.clear());

    it("konstruksi ditunda sampai akses pertama", () => {
        let built = 0;

        @Bean("HeavyBean")
        @Lazy()
        class HeavyBean {
            constructor() {
                built++;
            }
            ping() {
                return "pong";
            }
        }

        const proxy = resolve<HeavyBean>("HeavyBean");
        expect(built).toBe(0);
        expect(proxy.ping()).toBe("pong");
        expect(built).toBe(1);

        const again = resolve<HeavyBean>("HeavyBean");
        expect(again.ping()).toBe("pong");
        expect(built).toBe(1);
    });
});

describe("@ConditionalOnProperty", () => {
    beforeEach(() => {
        container.clear();
        setFrameworkConfig(fakeConfig);
    });

    it("aktif ketika property cocok havingValue", () => {
        @Bean("FeatureA")
        @ConditionalOnProperty({ property: "FEATURE_ON", havingValue: "true" })
        class FeatureABean {}
        void FeatureABean;

        expect(resolve("FeatureA")).toBeDefined();
    });

    it("tidak aktif ketika property absen tanpa matchIfMissing", () => {
        @Bean("FeatureB")
        @ConditionalOnProperty({ property: "NOT_SET", havingValue: "true" })
        class FeatureBBean {}
        void FeatureBBean;

        expect(() => resolve("FeatureB")).toThrow(/conditional/i);
    });

    it("matchIfMissing true mengizinkan bean saat property absen", () => {
        @Bean("FeatureC")
        @ConditionalOnProperty({ property: "ALSO_NOT_SET", matchIfMissing: true })
        class FeatureCBean {}
        void FeatureCBean;

        expect(resolve("FeatureC")).toBeDefined();
    });
});

describe("extension points", () => {
    beforeEach(() => container.clear());

    it("BeanFactoryPostProcessor memodifikasi definisi sebelum bean pertama dibuat", () => {
        registerBeanFactoryPostProcessor((registry) => {
            const def = registry.getDefinitions().find((d) => d.token === "SwapTarget");
            def?.replaceClass(class Replacement {});
        });

        @Bean("SwapTarget")
        class Original {}

        expect(resolve<{ constructor: { name: string } }>("SwapTarget").constructor.name).toBe(
            "Replacement"
        );
    });

    it("BeanPostProcessor berjalan sebelum & sesudah @PostConstruct", () => {
        const events: string[] = [];

        registerBeanPostProcessor({
            postProcessBeforeInitialization(instance) {
                events.push("before");
                return instance;
            },
            postProcessAfterInitialization(instance) {
                events.push("after");
                return instance;
            },
        });

        @Bean("LifecycleBean")
        class LifecycleBean {
            @PostConstruct()
            init() {
                events.push("post-construct");
            }
        }

        resolve("LifecycleBean");
        expect(events).toEqual(["before", "post-construct", "after"]);
    });
});
