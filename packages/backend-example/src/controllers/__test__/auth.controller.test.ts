describe("login rate limiting", () => {
    const loginAttempts = new Map<string, { count: number; resetAt: number; lockedUntil?: number }>();
    const LOGIN_MAX_ATTEMPTS = 5;
    const LOGIN_WINDOW_MS = 15 * 60 * 1000;
    const LOGIN_LOCKOUT_MS = 30 * 60 * 1000;

    function checkLoginRateLimit(email: string): void {
        const now = Date.now();
        let bucket = loginAttempts.get(email);
        if (!bucket || bucket.resetAt <= now) {
            bucket = { count: 0, resetAt: now + LOGIN_WINDOW_MS };
            loginAttempts.set(email, bucket);
        }
        if (bucket.lockedUntil && bucket.lockedUntil > now) {
            throw new Error("Account locked. Try again later.");
        }
        bucket.count++;
        if (bucket.count > LOGIN_MAX_ATTEMPTS) {
            bucket.lockedUntil = now + LOGIN_LOCKOUT_MS;
            throw new Error("Too many failed attempts. Account locked for 30 minutes.");
        }
    }

    function recordLoginSuccess(email: string): void {
        loginAttempts.delete(email);
    }

    beforeEach(() => {
        loginAttempts.clear();
    });

    it("allows login within rate limit", () => {
        for (let i = 0; i < LOGIN_MAX_ATTEMPTS; i++) {
            expect(() => checkLoginRateLimit("user@test.com")).not.toThrow();
        }
    });

    it("locks account after exceeding max attempts", () => {
        for (let i = 0; i < LOGIN_MAX_ATTEMPTS; i++) {
            checkLoginRateLimit("user@test.com");
        }
        expect(() => checkLoginRateLimit("user@test.com")).toThrow("Too many failed");
    });

    it("rejects login while account is locked", () => {
        for (let i = 0; i < LOGIN_MAX_ATTEMPTS; i++) {
            checkLoginRateLimit("locked@test.com");
        }
        expect(() => checkLoginRateLimit("locked@test.com")).toThrow("Too many failed");
        expect(() => checkLoginRateLimit("locked@test.com")).toThrow("Account locked");
    });

    it("recordLoginSuccess clears the bucket", () => {
        for (let i = 0; i < 3; i++) {
            checkLoginRateLimit("user@test.com");
        }
        recordLoginSuccess("user@test.com");
        expect(loginAttempts.has("user@test.com")).toBe(false);
    });

    it("tracks different emails independently", () => {
        for (let i = 0; i < LOGIN_MAX_ATTEMPTS; i++) {
            checkLoginRateLimit("a@test.com");
        }
        expect(() => checkLoginRateLimit("a@test.com")).toThrow();
        expect(() => checkLoginRateLimit("b@test.com")).not.toThrow();
    });

    it("resets bucket after window expires", () => {
        const bucket = { count: LOGIN_MAX_ATTEMPTS, resetAt: Date.now() - 1 };
        loginAttempts.set("expired@test.com", bucket);
        expect(() => checkLoginRateLimit("expired@test.com")).not.toThrow();
    });
});
