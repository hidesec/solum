import { OAuth2Client, GoogleOAuth2Provider, GithubOAuth2Provider } from "../oauth2/oauth2-client";

describe("isSafeUrl (via OAuth2Client constructor)", () => {
    it("rejects non-HTTPS URLs", () => {
        expect(() =>
            new OAuth2Client({
                name: "test",
                authorizationUrl: "http://example.com/auth",
                tokenUrl: "https://example.com/token",
                userInfoUrl: "https://example.com/user",
                clientId: "id",
                clientSecret: "secret",
                redirectUri: "https://localhost/callback",
                scopes: [],
            })
        ).toThrow("HTTPS");
    });

    it("rejects all non-HTTPS URLs", () => {
        expect(() =>
            new OAuth2Client({
                name: "test",
                authorizationUrl: "https://example.com/auth",
                tokenUrl: "http://example.com/token",
                userInfoUrl: "https://example.com/user",
                clientId: "id",
                clientSecret: "secret",
                redirectUri: "https://localhost/callback",
                scopes: [],
            })
        ).toThrow("HTTPS");
    });

    it("rejects non-HTTPS userInfoUrl", () => {
        expect(() =>
            new OAuth2Client({
                name: "test",
                authorizationUrl: "https://example.com/auth",
                tokenUrl: "https://example.com/token",
                userInfoUrl: "http://example.com/user",
                clientId: "id",
                clientSecret: "secret",
                redirectUri: "https://localhost/callback",
                scopes: [],
            })
        ).toThrow("HTTPS");
    });

    it("rejects invalid URLs", () => {
        expect(() =>
            new OAuth2Client({
                name: "test",
                authorizationUrl: "not-a-url",
                tokenUrl: "https://example.com/token",
                userInfoUrl: "https://example.com/user",
                clientId: "id",
                clientSecret: "secret",
                redirectUri: "https://localhost/callback",
                scopes: [],
            })
        ).toThrow("HTTPS");
    });

    it("accepts all HTTPS URLs", () => {
        expect(() =>
            new OAuth2Client({
                name: "test",
                authorizationUrl: "https://example.com/auth",
                tokenUrl: "https://example.com/token",
                userInfoUrl: "https://example.com/user",
                clientId: "id",
                clientSecret: "secret",
                redirectUri: "https://localhost/callback",
                scopes: [],
            })
        ).not.toThrow();
    });
});

describe("OAuth2Client", () => {
    const client = new OAuth2Client({
        name: "test",
        authorizationUrl: "https://example.com/auth",
        tokenUrl: "https://example.com/token",
        userInfoUrl: "https://example.com/user",
        clientId: "test-id",
        clientSecret: "test-secret",
        redirectUri: "https://localhost/callback",
        scopes: ["openid", "email"],
    });

    it("generateAuthUrl returns URL with PKCE challenge", () => {
        const { url, state } = client.generateAuthUrl();
        expect(url).toContain("https://example.com/auth?");
        expect(url).toContain("client_id=test-id");
        expect(url).toContain("response_type=code");
        expect(url).toContain("code_challenge=");
        expect(url).toContain("code_challenge_method=S256");
        expect(url).toContain(`state=${state}`);
        expect(url).toContain("scope=openid+email");
        expect(state.length).toBe(64);
    });

    it("validateState returns true for valid state", () => {
        const { state } = client.generateAuthUrl();
        expect(client.validateState(state)).toBe(true);
    });

    it("validateState returns false for invalid state", () => {
        expect(client.validateState("nonexistent")).toBe(false);
    });

    it("consumeState removes and returns state", () => {
        const { state } = client.generateAuthUrl();
        const consumed = client.consumeState(state);
        expect(consumed).toBeDefined();
        expect(consumed!.state).toBe(state);
        expect(client.validateState(state)).toBe(false);
    });

    it("consumeState returns undefined for invalid state", () => {
        expect(client.consumeState("nonexistent")).toBeUndefined();
    });

    it("exchangeCode rejects with invalid state", async () => {
        await expect(client.exchangeCode("code", "invalid")).rejects.toThrow("Invalid or expired");
    });

    it("pruneStates removes expired states", () => {
        const { state } = client.generateAuthUrl();
        expect(client.validateState(state)).toBe(true);
    });
});

describe("GoogleOAuth2Provider", () => {
    it("has correct default values", () => {
        const provider = new GoogleOAuth2Provider({
            clientId: "id",
            clientSecret: "secret",
        });
        expect(provider.name).toBe("google");
        expect(provider.authorizationUrl).toBe("https://accounts.google.com/o/oauth2/v2/auth");
        expect(provider.scopes).toContain("openid");
        expect(provider.scopes).toContain("email");
    });
});

describe("GithubOAuth2Provider", () => {
    it("has correct default values", () => {
        const provider = new GithubOAuth2Provider({
            clientId: "id",
            clientSecret: "secret",
        });
        expect(provider.name).toBe("github");
        expect(provider.authorizationUrl).toBe("https://github.com/login/oauth/authorize");
    });
});
