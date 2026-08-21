import { Bean, Profile, getActiveProfiles, container } from "@solumjs/core";
import { ConfigPort, setFrameworkConfig } from "@solumjs/core";

const fakeConfig: ConfigPort = {
    get: (key) => ({ NODE_ENV: "test" }[key]),
    getNumber: () => undefined,
    getBoolean: () => undefined,
};

describe("@Profile", () => {
    beforeAll(() => {
        setFrameworkConfig(fakeConfig);
    });

    @Bean()
    @Profile("dev")
    class DevOnlyBean {
        value = "dev";
    }

    @Bean()
    @Profile("prod", "test")
    class MultiProfileBean {
        value = "prod-or-test";
    }

    class PlainBean {
        value = "always";
    }

    container.register("PlainBean", { useClass: PlainBean });

    it("melempar error saat profile tidak aktif", () => {
        expect(() => container.resolve("DevOnlyBean")).toThrow(/@Profile/);
    });

    it("me-resolve bean saat salah satu profile cocok", () => {
        const bean = container.resolve<MultiProfileBean>("MultiProfileBean");
        expect(bean.value).toBe("prod-or-test");
    });

    it("bean tanpa @Profile selalu tersedia", () => {
        expect(container.resolve<PlainBean>("PlainBean").value).toBe("always");
    });

    it("mendukung daftar profile dipisah koma", () => {
        setFrameworkConfig({
            get: (key) => ({ NODE_ENV: "dev,test" }[key]),
            getNumber: () => undefined,
            getBoolean: () => undefined,
        });
        expect(getActiveProfiles()).toEqual(["dev", "test"]);
        setFrameworkConfig(fakeConfig);
    });
});
