import { OAuth2Client, OAuth2UserInfo } from "./oauth2-client";

export interface OAuth2GuardOptions {
    provider: OAuth2Client;
    onSuccess?: (user: OAuth2UserInfo) => Promise<{ redirect: string } | { json: unknown }>;
    onFailure?: (error: Error) => Promise<{ redirect: string } | { json: unknown }>;
}

export interface OAuth2RouteHandlers {
    handleAuthRedirect: (req: any, res: any) => void;
    handleCallback: (req: any, res: any) => void;
}

export function createOAuth2Routes(options: OAuth2GuardOptions): OAuth2RouteHandlers {
    const { provider } = options;

    return {
        handleAuthRedirect: (req: any, res: any) => {
            const { url } = provider.generateAuthUrl();
            res.status(302).setHeader("Location", url).end();
        },

        handleCallback: async (req: any, res: any) => {
            try {
                const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
                const code = url.searchParams.get("code");
                const state = url.searchParams.get("state");

                if (!code || !state) {
                    res.status(400).json({ error: "Missing code or state parameter" });
                    return;
                }

                const stateData = provider.consumeState(state);
                if (!stateData) {
                    res.status(400).json({ error: "Invalid or expired state parameter" });
                    return;
                }

                const tokenResponse = await provider.exchangeCode(code, state);
                const userInfo = await provider.getUserInfo(tokenResponse.access_token);

                if (options.onSuccess) {
                    const result = await options.onSuccess(userInfo);
                    if ("redirect" in result) {
                        res.status(302).setHeader("Location", result.redirect).end();
                    } else {
                        res.status(200).json(result.json);
                    }
                } else {
                    res.status(200).json({
                        user: userInfo,
                        accessToken: tokenResponse.access_token,
                        tokenType: tokenResponse.token_type,
                    });
                }
            } catch (error) {
                if (options.onFailure) {
                    const result = await options.onFailure(error as Error);
                    if ("redirect" in result) {
                        res.status(302).setHeader("Location", result.redirect).end();
                    } else {
                        res.status(500).json(result.json);
                    }
                } else {
                    res.status(500).json({ error: (error as Error).message });
                }
            }
        },
    };
}
