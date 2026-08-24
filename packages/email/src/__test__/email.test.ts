import {
    sanitizeHeaderValue,
    sanitizeSmtpAddress,
    base64Encode,
    parseSmtpResponse,
    TemplateEngine,
    enableTestMode,
    disableTestMode,
    getSentEmails,
    getLastSentEmail,
    clearSentEmails,
    MailService,
} from "../index";

describe("sanitizeHeaderValue", () => {
    it("should strip \\r\\n from header values", () => {
        expect(sanitizeHeaderValue("hello\r\nworld")).toBe("helloworld");
    });

    it("should strip \\n from header values", () => {
        expect(sanitizeHeaderValue("test\ninjection")).toBe("testinjection");
    });

    it("should pass through safe values", () => {
        expect(sanitizeHeaderValue("normal value")).toBe("normal value");
    });
});

describe("sanitizeSmtpAddress", () => {
    it("should strip angle brackets", () => {
        expect(sanitizeSmtpAddress("<user@example.com>")).toBe("user@example.com");
    });

    it("should strip \\r\\n", () => {
        expect(sanitizeSmtpAddress("user@example.com\r\nBCC: evil@hacker.com")).toBe("user@example.comBCC: evil@hacker.com");
    });

    it("should trim whitespace", () => {
        expect(sanitizeSmtpAddress("  user@example.com  ")).toBe("user@example.com");
    });

    it("should pass through clean addresses", () => {
        expect(sanitizeSmtpAddress("user@example.com")).toBe("user@example.com");
    });
});

describe("base64Encode", () => {
    it("should encode to base64", () => {
        expect(base64Encode("hello")).toBe("aGVsbG8=");
    });

    it("should handle empty string", () => {
        expect(base64Encode("")).toBe("");
    });

    it("should handle unicode", () => {
        const encoded = base64Encode("café");
        expect(typeof encoded).toBe("string");
        expect(encoded.length).toBeGreaterThan(0);
    });
});

describe("parseSmtpResponse", () => {
    it("should parse valid SMTP response", () => {
        const result = parseSmtpResponse("220 smtp.example.com ESMTP");
        expect(result.code).toBe(220);
        expect(result.message).toBe("smtp.example.com ESMTP");
    });

    it("should handle response with no message", () => {
        const result = parseSmtpResponse("250 OK");
        expect(result.code).toBe(250);
        expect(result.message).toBe("OK");
    });

    it("should return code 0 for invalid response", () => {
        const result = parseSmtpResponse("invalid");
        expect(result.code).toBe(0);
        expect(result.message).toBe("invalid");
    });
});

describe("TemplateEngine", () => {
    let engine: TemplateEngine;

    beforeEach(() => {
        engine = new TemplateEngine();
    });

    it("should register and render templates", () => {
        engine.register({
            name: "welcome",
            subject: "Welcome {{name}}!",
            html: "<h1>Hello {{name}}</h1>",
            text: "Hello {{name}}",
        });

        const result = engine.render("welcome", { name: "World" });
        expect(result.subject).toBe("Welcome World!");
        expect(result.html).toBe("<h1>Hello World</h1>");
        expect(result.text).toBe("Hello World");
    });

    it("should escape HTML entities in rendered output", () => {
        engine.register({
            name: "test",
            subject: "{{value}}",
            html: "{{value}}",
            text: "{{value}}",
        });

        const result = engine.render("test", { value: '<script>alert("xss")</script>' });
        expect(result.html).not.toContain("<script>");
        expect(result.html).toContain("&lt;script&gt;");
    });

    it("should list registered template names", () => {
        engine.register({ name: "a", subject: "", html: "", text: "" });
        engine.register({ name: "b", subject: "", html: "", text: "" });

        expect(engine.getTemplateNames()).toContain("a");
        expect(engine.getTemplateNames()).toContain("b");
    });

    it("should throw for non-existent template", () => {
        expect(() => engine.render("nonexistent", {})).toThrow("not found");
    });
});

describe("MailService test mode", () => {
    beforeEach(() => {
        disableTestMode();
        clearSentEmails();
    });

    it("should intercept emails in test mode", () => {
        enableTestMode();
        const service = new MailService({
            host: "smtp.test.com",
            port: 587,
            secure: false,
            auth: { user: "test", pass: "pass" },
            from: "test@test.com",
        });

        service.send({ to: "recipient@test.com", subject: "Test", text: "Hello" });

        const emails = getSentEmails();
        expect(emails).toHaveLength(1);
        expect(emails[0].to).toBe("recipient@test.com");
        expect(emails[0].subject).toBe("Test");
    });

    it("should return last sent email", () => {
        enableTestMode();
        const service = new MailService({
            host: "smtp.test.com",
            port: 587,
            secure: false,
            auth: { user: "test", pass: "pass" },
            from: "test@test.com",
        });

        service.send({ to: "a@test.com", subject: "First", text: "1" });
        service.send({ to: "b@test.com", subject: "Second", text: "2" });

        const last = getLastSentEmail();
        expect(last?.to).toBe("b@test.com");
        expect(last?.subject).toBe("Second");
    });

    it("should clear sent emails", () => {
        enableTestMode();
        const service = new MailService({
            host: "smtp.test.com",
            port: 587,
            secure: false,
            auth: { user: "test", pass: "pass" },
            from: "test@test.com",
        });

        service.send({ to: "test@test.com", subject: "Test", text: "Hello" });
        clearSentEmails();
        expect(getSentEmails()).toHaveLength(0);
    });

    it("should mask password in config", () => {
        const service = new MailService({
            host: "smtp.test.com",
            port: 587,
            secure: false,
            auth: { user: "test", pass: "secret123" },
            from: "test@test.com",
        });

        const config = service.getConfig();
        expect(config.auth?.pass).toMatch(/^\*+$/);
    });
});
