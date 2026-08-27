import crypto from "crypto";
import http from "http";
import https from "https";
import { getFrameworkConfig } from "@solumjs/core";

export interface OAuth2Provider {
    name: string;
    authorizationUrl: string;
    tokenUrl: string;
    userInfoUrl: string;
    clientId: string;
    clientSecret: string;
    redirectUri: string;
    scopes: string[];
}

export interface OAuth2TokenResponse {
    access_token: string;
    token_type: string;
    expires_in: number;
    refresh_token?: string;
    scope?: string;
}

export interface OAuth2UserInfo {
    id: string;
    email: string;
    name: string;
    picture?: string;
    provider: string;
}

export interface OAuth2State {
    state: string;
    provider: string;
    codeVerifier?: string;
}

export class GoogleOAuth2Provider implements OAuth2Provider {
    name = "google";
    authorizationUrl = "https://accounts.google.com/o/oauth2/v2/auth";
    tokenUrl = "https://oauth2.googleapis.com/token";
    userInfoUrl = "https://www.googleapis.com/oauth2/v2/userinfo";
    clientId: string;
    clientSecret: string;
    redirectUri: string;
    scopes = ["openid", "email", "profile"];

    constructor(options?: { clientId?: string; clientSecret?: string; redirectUri?: string; scopes?: string[] }) {
        this.clientId = options?.clientId || getFrameworkConfig().get("GOOGLE_CLIENT_ID") || "";
        this.clientSecret = options?.clientSecret || getFrameworkConfig().get("GOOGLE_CLIENT_SECRET") || "";
        this.redirectUri = options?.redirectUri || getFrameworkConfig().get("GOOGLE_REDIRECT_URI") || "https://localhost:3000/auth/callback/google";
        if (options?.scopes) this.scopes = options.scopes;
    }
}

export class GithubOAuth2Provider implements OAuth2Provider {
    name = "github";
    authorizationUrl = "https://github.com/login/oauth/authorize";
    tokenUrl = "https://github.com/login/oauth/access_token";
    userInfoUrl = "https://api.github.com/user";
    clientId: string;
    clientSecret: string;
    redirectUri: string;
    scopes = ["user:email"];

    constructor(options?: { clientId?: string; clientSecret?: string; redirectUri?: string; scopes?: string[] }) {
        this.clientId = options?.clientId || getFrameworkConfig().get("GITHUB_CLIENT_ID") || "";
        this.clientSecret = options?.clientSecret || getFrameworkConfig().get("GITHUB_CLIENT_SECRET") || "";
        this.redirectUri = options?.redirectUri || getFrameworkConfig().get("GITHUB_REDIRECT_URI") || "https://localhost:3000/auth/callback/github";
        if (options?.scopes) this.scopes = options.scopes;
    }
}

function isSafeUrl(url: string): boolean {
    try {
        const parsed = new URL(url);
        return parsed.protocol === "https:" || parsed.protocol === "http:";
    } catch {
        return false;
    }
}

const OAUTH2_STATE_TTL_MS = 10 * 60 * 1000;

export class OAuth2Client {
    private states = new Map<string, OAuth2State & { createdAt: number }>();

    private pruneStates(): void {
        const now = Date.now();
        for (const [key, state] of this.states) {
            if (now - state.createdAt > OAUTH2_STATE_TTL_MS) {
                this.states.delete(key);
            }
        }
    }

    constructor(private provider: OAuth2Provider) {
        if (!isSafeUrl(provider.authorizationUrl)) {
            throw new Error("OAuth2 authorizationUrl must be a valid HTTPS or HTTP URL");
        }
        if (!isSafeUrl(provider.tokenUrl)) {
            throw new Error("OAuth2 tokenUrl must be a valid HTTPS or HTTP URL");
        }
        if (!isSafeUrl(provider.userInfoUrl)) {
            throw new Error("OAuth2 userInfoUrl must be a valid HTTPS or HTTP URL");
        }
    }

    generateAuthUrl(): { url: string; state: string } {
        this.pruneStates();
        const state = crypto.randomBytes(32).toString("hex");
        const codeVerifier = crypto.randomBytes(32).toString("base64url");
        const codeChallenge = crypto.createHash("sha256").update(codeVerifier).digest("base64url");

        this.states.set(state, {
            state,
            provider: this.provider.name,
            codeVerifier,
            createdAt: Date.now(),
        });

        const params = new URLSearchParams({
            client_id: this.provider.clientId,
            redirect_uri: this.provider.redirectUri,
            response_type: "code",
            scope: this.provider.scopes.join(" "),
            state,
            code_challenge: codeChallenge,
            code_challenge_method: "S256",
        });

        return {
            url: `${this.provider.authorizationUrl}?${params.toString()}`,
            state,
        };
    }

    validateState(state: string): boolean {
        return this.states.has(state);
    }

    consumeState(state: string): OAuth2State | undefined {
        const s = this.states.get(state);
        this.states.delete(state);
        return s;
    }

    async exchangeCode(code: string, state: string): Promise<OAuth2TokenResponse> {
        const stateData = this.consumeState(state);
        if (!stateData) {
            throw new Error("Invalid or expired OAuth2 state");
        }

        const params = new URLSearchParams({
            client_id: this.provider.clientId,
            client_secret: this.provider.clientSecret,
            code,
            redirect_uri: this.provider.redirectUri,
            grant_type: "authorization_code",
            code_verifier: stateData.codeVerifier || "",
        });

        const response = await httpPost(this.provider.tokenUrl, params.toString(), {
            "Content-Type": "application/x-www-form-urlencoded",
            Accept: "application/json",
        });

        return JSON.parse(response) as OAuth2TokenResponse;
    }

    async getUserInfo(accessToken: string): Promise<OAuth2UserInfo> {
        const response = await httpGet(this.provider.userInfoUrl, {
            Authorization: `Bearer ${accessToken}`,
            Accept: "application/json",
        });

        const data = JSON.parse(response);

        if (this.provider.name === "google") {
            return {
                id: data.id,
                email: data.email,
                name: data.name,
                picture: data.picture,
                provider: "google",
            };
        }

        if (this.provider.name === "github") {
            return {
                id: String(data.id),
                email: data.email,
                name: data.name || data.login,
                picture: data.avatar_url,
                provider: "github",
            };
        }

        return {
            id: String(data.id || data.sub),
            email: data.email,
            name: data.name || data.login || data.email,
            picture: data.picture || data.avatar_url,
            provider: this.provider.name,
        };
    }
}

function httpPost(url: string, body: string, headers: Record<string, string>): Promise<string> {
    const { promise, resolve, reject } = Promise.withResolvers<string>();
    const parsed = new URL(url);
    const client = parsed.protocol === "https:" ? https : http;

    const req = client.request(
        {
            hostname: parsed.hostname,
            port: parsed.port,
            path: parsed.pathname + parsed.search,
            method: "POST",
            headers: { ...headers, "Content-Length": Buffer.byteLength(body).toString() },
        },
        (res) => {
            const chunks: Buffer[] = [];
            res.on("data", (chunk) => chunks.push(chunk));
            res.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
        }
    );

    req.on("error", reject);
    req.write(body);
    req.end();

    return promise;
}

function httpGet(url: string, headers: Record<string, string>): Promise<string> {
    const { promise, resolve, reject } = Promise.withResolvers<string>();
    const parsed = new URL(url);
    const client = parsed.protocol === "https:" ? https : http;

    const req = client.request(
        {
            hostname: parsed.hostname,
            port: parsed.port,
            path: parsed.pathname + parsed.search,
            method: "GET",
            headers,
        },
        (res) => {
            const chunks: Buffer[] = [];
            res.on("data", (chunk) => chunks.push(chunk));
            res.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
        }
    );

    req.on("error", reject);
    req.end();

    return promise;
}
