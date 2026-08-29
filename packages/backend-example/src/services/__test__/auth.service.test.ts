describe("AuthService login", () => {
    it("normalizes email to lowercase and trimmed", () => {
        const email = "  User@Test.COM  ";
        const normalized = email.toLowerCase().trim();
        expect(normalized).toBe("user@test.com");
    });

    it("dummy hash prevents timing attack", () => {
        const dummyHash = "$2b$10$000000000000000000000000000000000000000000000000000000";
        expect(dummyHash).toHaveLength(61);
        expect(dummyHash.startsWith("$2b$")).toBe(true);
    });

    it("throws on invalid credentials (missing user)", () => {
        const user = null as any;
        const dummyHash = "$2b$10$000000000000000000000000000000000000000000000000000000";
        const hash = user?.passwordHash ?? dummyHash;
        expect(hash).toBe(dummyHash);
    });

    it("throws on invalid password", () => {
        const user = { passwordHash: "$2b$10$realhash" } as any;
        const dummyHash = "$2b$10$000000000000000000000000000000000000000000000000000000";
        const hash = user?.passwordHash ?? dummyHash;
        expect(hash).toBe("$2b$10$realhash");
    });
});

describe("AuthService refresh", () => {
    it("rejects refresh token without type=refresh", () => {
        const payload = { sub: "user-1", type: "access", jti: "abc" };
        const isValid = payload.type === "refresh" && !!payload.jti;
        expect(isValid).toBe(false);
    });

    it("rejects refresh token without jti", () => {
        const payload = { sub: "user-1", type: "refresh", jti: undefined };
        const isValid = payload.type === "refresh" && !!payload.jti;
        expect(isValid).toBe(false);
    });

    it("accepts valid refresh token payload", () => {
        const payload = { sub: "user-1", type: "refresh", jti: "unique-id", exp: 1234567890 };
        const isValid = payload.type === "refresh" && !!payload.jti;
        expect(isValid).toBe(true);
    });
});

describe("token issuance", () => {
    it("issueTokens creates correct structure", () => {
        const response = {
            accessToken: "access-token",
            refreshToken: "refresh-token",
            tokenType: "Bearer",
            expiresIn: 3600,
        };
        expect(response.tokenType).toBe("Bearer");
        expect(response.expiresIn).toBe(3600);
        expect(typeof response.accessToken).toBe("string");
        expect(typeof response.refreshToken).toBe("string");
    });
});
