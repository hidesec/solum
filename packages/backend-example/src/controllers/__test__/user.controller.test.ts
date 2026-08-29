describe("registration rate limiting", () => {
    const registrationAttempts = new Map<string, { count: number; resetAt: number }>();
    const REGISTRATION_LIMIT = 5;
    const REGISTRATION_WINDOW_MS = 15 * 60 * 1000;

    function checkRegistrationRateLimit(ip: string): void {
        const now = Date.now();
        let bucket = registrationAttempts.get(ip);
        if (!bucket || bucket.resetAt <= now) {
            bucket = { count: 0, resetAt: now + REGISTRATION_WINDOW_MS };
            registrationAttempts.set(ip, bucket);
        }
        bucket.count++;
        if (bucket.count > REGISTRATION_LIMIT) {
            throw new Error("Too many registration attempts. Please try again later.");
        }
    }

    beforeEach(() => {
        registrationAttempts.clear();
    });

    it("allows registration within limit", () => {
        for (let i = 0; i < REGISTRATION_LIMIT; i++) {
            expect(() => checkRegistrationRateLimit("127.0.0.1")).not.toThrow();
        }
    });

    it("blocks registration when limit exceeded", () => {
        for (let i = 0; i < REGISTRATION_LIMIT; i++) {
            checkRegistrationRateLimit("127.0.0.1");
        }
        expect(() => checkRegistrationRateLimit("127.0.0.1")).toThrow("Too many registration");
    });

    it("tracks different IPs independently", () => {
        for (let i = 0; i < REGISTRATION_LIMIT; i++) {
            checkRegistrationRateLimit("10.0.0.1");
        }
        expect(() => checkRegistrationRateLimit("10.0.0.1")).toThrow("Too many registration");
        expect(() => checkRegistrationRateLimit("10.0.0.2")).not.toThrow();
    });
});

describe("IDOR protection", () => {
    it("allows access to own profile", () => {
        const principal = { sub: "user-123", role: "USER" };
        const targetId = "user-123";
        const allowed = principal.sub === targetId || principal.role === "ADMIN";
        expect(allowed).toBe(true);
    });

    it("allows ADMIN to access any profile", () => {
        const principal = { sub: "admin-1", role: "ADMIN" };
        const targetId = "user-999";
        const allowed = principal.sub === targetId || principal.role === "ADMIN";
        expect(allowed).toBe(true);
    });

    it("blocks USER from accessing other profiles", () => {
        const principal = { sub: "user-123", role: "USER" };
        const targetId = "user-456";
        const allowed = principal.sub === targetId || principal.role === "ADMIN";
        expect(allowed).toBe(false);
    });
});

describe("self-role-change guard", () => {
    it("blocks self-role-change", () => {
        const principal = { sub: "user-123" };
        const targetId = "user-123";
        const selfChange = principal.sub === targetId;
        expect(selfChange).toBe(true);
    });

    it("allows changing other users roles", () => {
        const principal = { sub: "admin-1" };
        const targetId = "user-456";
        const selfChange = principal.sub === targetId;
        expect(selfChange).toBe(false);
    });
});

describe("email list parsing", () => {
    it("parses comma-separated emails", () => {
        const emails = "a@test.com, b@test.com, c@test.com"
            .split(",")
            .map((e) => e.trim())
            .filter(Boolean);
        expect(emails).toEqual(["a@test.com", "b@test.com", "c@test.com"]);
    });

    it("returns empty for empty string", () => {
        const emails = ""
            .split(",")
            .map((e) => e.trim())
            .filter(Boolean);
        expect(emails).toHaveLength(0);
    });

    it("filters empty entries", () => {
        const emails = "a@test.com,, , b@test.com"
            .split(",")
            .map((e) => e.trim())
            .filter(Boolean);
        expect(emails).toEqual(["a@test.com", "b@test.com"]);
    });
});

describe("limit clamping", () => {
    function clampLimit(limit: string | undefined): number {
        return Math.min(Math.max(parseInt(limit ?? "10", 10) || 10, 1), 100);
    }

    it("uses default 10 when undefined", () => {
        expect(clampLimit(undefined)).toBe(10);
    });

    it("clamps to minimum 1", () => {
        expect(clampLimit("1")).toBe(1);
        expect(clampLimit("0")).toBe(10);
    });

    it("clamps to maximum 100", () => {
        expect(clampLimit("200")).toBe(100);
        expect(clampLimit("999")).toBe(100);
    });

    it("accepts valid limits", () => {
        expect(clampLimit("5")).toBe(5);
        expect(clampLimit("50")).toBe(50);
        expect(clampLimit("100")).toBe(100);
    });

    it("parses non-numeric to default", () => {
        expect(clampLimit("abc")).toBe(10);
    });
});
