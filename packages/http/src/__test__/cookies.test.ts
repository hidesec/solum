import { parseCookies, serializeSetCookie } from "../cookies";

describe("cookies", () => {
    it("parses cookie header into map", () => {
        expect(parseCookies("a=1; b=2")).toEqual({ a: "1", b: "2" });
    });

    it("handles quoted values and url encoding", () => {
        const parsed = parseCookies('sid="x y"; name=hello%20world');
        expect(parsed.sid).toBe("x y");
        expect(parsed.name).toBe("hello world");
    });

    it("returns empty object for missing or malformed headers", () => {
        expect(parseCookies(undefined)).toEqual({});
        expect(parseCookies("nonsense")).toEqual({});
        expect(parseCookies("")).toEqual({});
    });

    it("serializes with defaults", () => {
        const cookie = serializeSetCookie("sid", "abc");
        expect(cookie).toBe("sid=abc; Path=/; HttpOnly; SameSite=Lax");
    });

    it("serializes full options", () => {
        const cookie = serializeSetCookie("sid", "abc", {
            maxAge: 60,
            domain: "example.com",
            path: "/app",
            secure: true,
            httpOnly: true,
            sameSite: "Lax",
        });
        expect(cookie).toBe(
            "sid=abc; Path=/app; Max-Age=60; Domain=example.com; Secure; HttpOnly; SameSite=Lax"
        );
    });

    it("omits HttpOnly when disabled", () => {
        expect(serializeSetCookie("a", "b", { httpOnly: false })).toBe("a=b; Path=/; SameSite=Lax");
    });
});
