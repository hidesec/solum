import { createOAuth2Routes } from "../oauth2/oauth2-guard";
import { OAuth2Client } from "../oauth2/oauth2-client";

function createMockOAuth2Client(): OAuth2Client {
    return new OAuth2Client({
        name: "test",
        authorizationUrl: "https://example.com/auth",
        tokenUrl: "https://example.com/token",
        userInfoUrl: "https://example.com/user",
        clientId: "id",
        clientSecret: "secret",
        redirectUri: "https://localhost/callback",
        scopes: [],
    });
}

function fakeReq(url: string = "/callback?code=abc&state=xyz"): any {
    return {
        url,
        method: "GET",
        headers: { host: "localhost:3000" },
        log: { info: () => {}, warn: () => {}, error: () => {} },
    };
}

function fakeRes(): any {
    let statusCode = 200;
    let headers: Record<string, string> = {};
    return {
        get statusCode() { return statusCode; },
        status(code: number) { statusCode = code; return this; },
        setHeader(k: string, v: string) { headers[k] = v; return this; },
        json: jest.fn(),
        end: jest.fn(),
        headers,
    };
}

describe("createOAuth2Routes", () => {
    it("handleAuthRedirect redirects to auth URL", () => {
        const provider = createMockOAuth2Client();
        const routes = createOAuth2Routes({ provider });
        const req = fakeReq();
        const res = fakeRes();

        routes.handleAuthRedirect(req, res);

        expect(res.statusCode).toBe(302);
        expect(res.headers["Location"]).toContain("https://example.com/auth");
    });

    it("handleCallback returns 400 when code is missing", async () => {
        const provider = createMockOAuth2Client();
        const routes = createOAuth2Routes({ provider });
        const req = fakeReq("/callback?state=xyz");
        const res = fakeRes();

        await routes.handleCallback(req, res);

        expect(res.statusCode).toBe(400);
    });

    it("handleCallback returns 400 when state is missing", async () => {
        const provider = createMockOAuth2Client();
        const routes = createOAuth2Routes({ provider });
        const req = fakeReq("/callback?code=abc");
        const res = fakeRes();

        await routes.handleCallback(req, res);

        expect(res.statusCode).toBe(400);
    });

    it("handleCallback returns 400 for invalid state", async () => {
        const provider = createMockOAuth2Client();
        const routes = createOAuth2Routes({ provider });
        const req = fakeReq("/callback?code=abc&state=invalid-state");
        const res = fakeRes();

        await routes.handleCallback(req, res);

        expect(res.statusCode).toBe(400);
    });

    it("handleCallback returns generic error on failure (no leak)", async () => {
        const provider = createMockOAuth2Client();
        jest.spyOn(provider, "exchangeCode").mockRejectedValue(new Error("network fail"));
        const { state } = provider.generateAuthUrl();
        const routes = createOAuth2Routes({ provider });
        const req = fakeReq(`/callback?code=abc&state=${state}`);
        const res = fakeRes();

        await routes.handleCallback(req, res);

        expect(res.statusCode).toBe(500);
        expect(res.json).toHaveBeenCalledWith({
            error: "OAuth2 authentication failed",
        });
    });

    it("handleCallback calls onFailure callback with generic message", async () => {
        const provider = createMockOAuth2Client();
        jest.spyOn(provider, "exchangeCode").mockRejectedValue(new Error("network fail"));
        const { state } = provider.generateAuthUrl();
        const onFailure = jest.fn().mockResolvedValue({ json: { error: "custom failure" } });
        const routes = createOAuth2Routes({ provider, onFailure });
        const req = fakeReq(`/callback?code=abc&state=${state}`);
        const res = fakeRes();

        await routes.handleCallback(req, res);

        expect(onFailure).toHaveBeenCalled();
        expect(res.json).toHaveBeenCalledWith({ error: "custom failure" });
    });

    it("handleCallback returns 400 when both code and state are missing", async () => {
        const provider = createMockOAuth2Client();
        const routes = createOAuth2Routes({ provider });
        const req = fakeReq("/callback");
        const res = fakeRes();

        await routes.handleCallback(req, res);

        expect(res.statusCode).toBe(400);
    });
});
