import "../reflect-metadata";
import {
    ResourceBundleMessageSource,
    createMessageSource,
    setDefaultMessage,
    getDefaultMessage,
    I18nMessage,
    getI18nMessages,
    AcceptHeaderLocaleResolver,
    FixedLocaleResolver,
} from "../i18n/message-source";

describe("ResourceBundleMessageSource", () => {
    it("returns message for exact locale", () => {
        const source = new ResourceBundleMessageSource();
        source.addMessages("en", { greeting: "Hello" });
        source.addMessages("id", { greeting: "Halo" });
        expect(source.getMessage("greeting", [], "en")).toBe("Hello");
        expect(source.getMessage("greeting", [], "id")).toBe("Halo");
    });

    it("falls back to default locale", () => {
        const source = new ResourceBundleMessageSource({ defaultLocale: "en", fallbackLocale: "en" });
        source.addMessages("en", { greeting: "Hello" });
        expect(source.getMessage("greeting", [], "fr")).toBe("Hello");
    });

    it("returns [MISSING: key] for unknown code", () => {
        const source = new ResourceBundleMessageSource();
        expect(source.getMessage("unknown")).toBe("[MISSING: unknown]");
    });

    it("interpolates positional args", () => {
        const source = new ResourceBundleMessageSource();
        source.addMessages("en", { hello: "Hello {0}, you are {1}" });
        expect(source.getMessage("hello", ["Alice", "25"], "en")).toBe("Hello Alice, you are 25");
    });

    it("getMessageWithDefault uses default when code missing", () => {
        const source = new ResourceBundleMessageSource();
        expect(source.getMessageWithDefault("missing", "fallback msg")).toBe("fallback msg");
    });

    it("getMessageWithDefault returns message when code exists", () => {
        const source = new ResourceBundleMessageSource();
        source.addMessages("en", { key: "found" });
        expect(source.getMessageWithDefault("key", "fallback")).toBe("found");
    });

    it("getMessages merges fallback and specific locale", () => {
        const source = new ResourceBundleMessageSource({ fallbackLocale: "en" });
        source.addMessages("en", { a: "1", b: "2" });
        source.addMessages("id", { b: "dua", c: "tiga" });
        const msgs = source.getMessages("id");
        expect(msgs.a).toBe("1");
        expect(msgs.b).toBe("dua");
        expect(msgs.c).toBe("tiga");
    });

    it("createMessageSource factory works", () => {
        const source = createMessageSource({ defaultLocale: "en" });
        expect(source).toBeInstanceOf(ResourceBundleMessageSource);
    });
});

describe("setDefaultMessage and getDefaultMessage", () => {
    it("stores and retrieves default message", () => {
        setDefaultMessage("test.key", "test value");
        expect(getDefaultMessage("test.key")).toBe("test value");
    });

    it("returns undefined for unknown key", () => {
        expect(getDefaultMessage("nonexistent")).toBeUndefined();
    });
});

describe("I18nMessage decorator", () => {
    it("registers metadata on class", () => {
        class TestClass {
            @I18nMessage("greeting")
            declare greeting: string;

            @I18nMessage("farewell", ["Alice"])
            declare farewell: string;
        }
        const messages = getI18nMessages(TestClass);
        expect(messages).toHaveLength(2);
        expect(messages[0].key).toBe("greeting");
        expect(messages[1].args).toEqual(["Alice"]);
    });

    it("returns empty array for class without decorator", () => {
        class Plain {}
        expect(getI18nMessages(Plain)).toEqual([]);
    });
});

describe("AcceptHeaderLocaleResolver", () => {
    it("parses Accept-Language header", () => {
        const resolver = new AcceptHeaderLocaleResolver();
        const locale = resolver.resolveLocale({ headers: { "accept-language": "id;q=0.9,en;q=1.0" } });
        expect(locale).toBe("en");
    });

    it("returns default when no header", () => {
        const resolver = new AcceptHeaderLocaleResolver({ defaultLocale: "en" });
        expect(resolver.resolveLocale({ headers: {} })).toBe("en");
    });

    it("returns first locale when no quality", () => {
        const resolver = new AcceptHeaderLocaleResolver();
        expect(resolver.resolveLocale({ headers: { "accept-language": "id,en" } })).toBe("id");
    });
});

describe("FixedLocaleResolver", () => {
    it("always returns fixed locale", () => {
        const resolver = new FixedLocaleResolver("id");
        expect(resolver.resolveLocale({})).toBe("id");
        expect(resolver.resolveLocale(null)).toBe("id");
    });
});
