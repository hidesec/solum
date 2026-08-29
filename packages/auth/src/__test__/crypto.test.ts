import { signJwt, verifyJwt, hashPassword, verifyPassword } from "../crypto.util";

const SECRET = "test-secret-key-at-least-32-chars!";

describe("signJwt and verifyJwt", () => {
    it("creates and verifies a valid token", () => {
        const token = signJwt({ sub: "user-1", role: "ADMIN" }, SECRET, 3600);
        const payload = verifyJwt<Record<string, any>>(token, SECRET);
        expect(payload).toBeDefined();
        expect(payload!.sub).toBe("user-1");
        expect(payload!.role).toBe("ADMIN");
        expect(typeof payload!.iat).toBe("number");
        expect(typeof payload!.exp).toBe("number");
    });

    it("rejects token with wrong secret", () => {
        const token = signJwt({ sub: "user-1" }, SECRET, 3600);
        const payload = verifyJwt(token, "wrong-secret-key-xxxxxxxxxxxxxxxxxx");
        expect(payload).toBeNull();
    });

    it("rejects expired token", () => {
        const token = signJwt({ sub: "user-1" }, SECRET, -1);
        const payload = verifyJwt(token, SECRET);
        expect(payload).toBeNull();
    });

    it("rejects token with wrong algorithm", () => {
        const parts = signJwt({ sub: "user-1" }, SECRET, 3600).split(".");
        const header = JSON.parse(Buffer.from(parts[0], "base64url").toString());
        header.alg = "HS512";
        parts[0] = Buffer.from(JSON.stringify(header)).toString("base64url");
        const payload = verifyJwt(parts.join("."), SECRET);
        expect(payload).toBeNull();
    });

    it("rejects token with only 2 parts", () => {
        expect(verifyJwt("abc.def", SECRET)).toBeNull();
    });

    it("rejects token longer than MAX_JWT_LENGTH", () => {
        const longToken = "x".repeat(9000);
        expect(verifyJwt(longToken, SECRET)).toBeNull();
    });

    it("respects issuer option", () => {
        const token = signJwt({ sub: "user-1", iss: "my-app" }, SECRET, 3600);
        expect(verifyJwt(token, SECRET, { issuer: "my-app" })).toBeDefined();
        expect(verifyJwt(token, SECRET, { issuer: "other-app" })).toBeNull();
    });

    it("respects audience option", () => {
        const token = signJwt({ sub: "user-1", aud: "api" }, SECRET, 3600);
        expect(verifyJwt(token, SECRET, { audience: "api" })).toBeDefined();
        expect(verifyJwt(token, SECRET, { audience: "web" })).toBeNull();
    });

    it("includes iss in header when payload has iss", () => {
        const token = signJwt({ sub: "user-1", iss: "my-issuer" }, SECRET, 3600);
        const header = JSON.parse(Buffer.from(token.split(".")[0], "base64url").toString());
        expect(header.iss).toBe("my-issuer");
    });
});

describe("hashPassword and verifyPassword", () => {
    it("hashes and verifies password", () => {
        const hash = hashPassword("my-password");
        expect(hash).toMatch(/^scrypt:/);
        expect(verifyPassword("my-password", hash)).toBe(true);
    });

    it("rejects wrong password", () => {
        const hash = hashPassword("correct-password");
        expect(verifyPassword("wrong-password", hash)).toBe(false);
    });

    it("rejects invalid hash format", () => {
        expect(verifyPassword("pass", "invalid")).toBe(false);
        expect(verifyPassword("pass", "md5:salt:hash")).toBe(false);
    });

    it("each hash is unique (random salt)", () => {
        const h1 = hashPassword("same-pass");
        const h2 = hashPassword("same-pass");
        expect(h1).not.toBe(h2);
    });
});
