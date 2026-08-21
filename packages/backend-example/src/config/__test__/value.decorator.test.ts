import { Value } from "@solumjs/config";
import { ConfigPort, setFrameworkConfig } from "@solumjs/core";

const fakeConfig: ConfigPort = {
    get: (key) => ({ APP_NAME: "solumjs", PORT: "3900", DEBUG: "true" }[key]),
    getNumber: () => undefined,
    getBoolean: () => undefined,
};

describe("@Value", () => {
    beforeAll(() => {
        setFrameworkConfig(fakeConfig);
    });

    class Cfg {
        @Value("APP_NAME")
        declare appName: string;

        @Value("PORT")
        declare port: number;

        @Value("DEBUG")
        declare debug: boolean;

        @Value("${DB_HOST:localhost}")
        declare dbHost: string;

        @Value("${MAX_RETRIES:5}")
        declare maxRetries: number;

        @Value("${REDIS_URL:redis://localhost:6379}")
        declare redisUrl: string;
    }

    it("membaca key biasa sebagai string", () => {
        expect(new Cfg().appName).toBe("solumjs");
    });

    it("mengkoersi Number sesuai design:type", () => {
        expect(new Cfg().port).toBe(3900);
    });

    it("mengkoersi Boolean sesuai design:type", () => {
        expect(new Cfg().debug).toBe(true);
    });

    it("memakai default saat key tidak ada", () => {
        expect(new Cfg().dbHost).toBe("localhost");
        expect(new Cfg().maxRetries).toBe(5);
    });

    it("default yang mengandung ':' tidak salah parse", () => {
        expect(new Cfg().redisUrl).toBe("redis://localhost:6379");
    });

    it("throw saat key absen dan tanpa default", () => {
        class Strict {
            @Value("MISSING_KEY")
            declare missing: string;
        }
        expect(() => new Strict().missing).toThrow(/MISSING_KEY/);
    });
});
