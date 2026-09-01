import { setFrameworkConfig, container } from "@solumjs/core";
import { createEnvConfig } from "@solumjs/config";

setFrameworkConfig(createEnvConfig({
    JWT_SECRET: "this-is-a-very-long-secret-key-for-testing-32chars",
}));

import { JwtService, REFRESH_TOKEN_TTL } from "../jwt.service";

describe("JwtService", () => {
    let jwtService: JwtService;

    beforeEach(() => {
        jwtService = new JwtService();
    });

    it("signAccessToken returns a string token", () => {
        const token = jwtService.signAccessToken({ sub: "user-1", email: "a@b.com", role: "USER" });
        expect(typeof token).toBe("string");
        expect(token.split(".")).toHaveLength(3);
    });

    it("signRefreshToken returns a string token", () => {
        const token = jwtService.signRefreshToken({ sub: "user-1", email: "a@b.com", role: "USER" });
        expect(typeof token).toBe("string");
        expect(token.split(".")).toHaveLength(3);
    });

    it("verify returns payload for valid access token", () => {
        const token = jwtService.signAccessToken({ sub: "user-1", email: "a@b.com", role: "ADMIN" });
        const payload = jwtService.verify(token);
        expect(payload).not.toBeNull();
        expect(payload!.sub).toBe("user-1");
        expect(payload!.type).toBe("access");
    });

    it("verify returns null for invalid token", () => {
        const { signJwt } = require("../crypto.util");
        const validHeader = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
        const validPayload = Buffer.from(JSON.stringify({ sub: "x", type: "access" })).toString("base64url");
        const badToken = `${validHeader}.${validPayload}.bad`;
        expect(jwtService.verify(badToken)).toBeNull();
    });

    it("verify returns null for token with wrong secret", () => {
        const { signJwt } = require("../crypto.util");
        const token = signJwt({ sub: "user-1", type: "access" }, "wrong-secret-that-is-long-enough-for-validation", 3600);
        expect(jwtService.verify(token)).toBeNull();
    });

    it("revoke makes token invalid", () => {
        const token = jwtService.signAccessToken({ sub: "user-1", email: "a@b.com", role: "USER" });
        expect(jwtService.verify(token)).not.toBeNull();
        jwtService.revoke(token);
        expect(jwtService.verify(token)).toBeNull();
    });

    it("isRevoked returns false for non-revoked token", () => {
        expect(jwtService.isRevoked("nonexistent-jti")).toBe(false);
    });

    it("token contains expected claims", () => {
        const token = jwtService.signAccessToken({ sub: "user-1", email: "a@b.com", role: "ADMIN" });
        const payload = jwtService.verify(token);
        expect(payload!.sub).toBe("user-1");
        expect(payload!.role).toBe("ADMIN");
        expect(payload!.type).toBe("access");
        expect(payload!.jti).toBeDefined();
        expect(typeof payload!.jti).toBe("string");
    });

    it("REFRESH_TOKEN_TTL is 7 days in seconds", () => {
        expect(REFRESH_TOKEN_TTL).toBe(7 * 24 * 3600);
    });

    it("throws when JWT_SECRET is not configured", () => {
        const originalConfig = require("@solumjs/core").getFrameworkConfig();
        const { setFrameworkConfig: setCfg } = require("@solumjs/core");
        const { createEnvConfig: createCfg } = require("@solumjs/config");
        setCfg(createCfg({}));

        const svc = new JwtService();
        expect(() => svc.signAccessToken({ sub: "u", email: "u@u.com", role: "USER" })).toThrow("JWT_SECRET");

        setFrameworkConfig(originalConfig);
    });

    it("throws when JWT_SECRET is too short", () => {
        const originalConfig = require("@solumjs/core").getFrameworkConfig();
        const { setFrameworkConfig: setCfg } = require("@solumjs/core");
        const { createEnvConfig: createCfg } = require("@solumjs/config");
        setCfg(createCfg({ JWT_SECRET: "short" }));

        const svc = new JwtService();
        expect(() => svc.signAccessToken({ sub: "u", email: "u@u.com", role: "USER" })).toThrow("too weak");

        setFrameworkConfig(originalConfig);
    });
});
