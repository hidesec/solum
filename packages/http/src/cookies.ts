import { CookieOptions } from "./http-types";

export function parseCookies(header: string | string[] | undefined): Record<string, string> {
    const raw = Array.isArray(header) ? header.join("; ") : header;
    const cookies: Record<string, string> = {};
    if (!raw) return cookies;

    for (const part of raw.split(";")) {
        const separator = part.indexOf("=");
        if (separator === -1) continue;
        const name = part.slice(0, separator).trim();
        if (!name) continue;
        let value = part.slice(separator + 1).trim();
        if (value.startsWith('"') && value.endsWith('"')) {
            value = value.slice(1, -1);
        }
        try {
            cookies[name] = decodeURIComponent(value);
        } catch {
            cookies[name] = value;
        }
    }
    return cookies;
}

export function serializeSetCookie(name: string, value: string, options: CookieOptions = {}): string {
    const parts: string[] = [`${name}=${encodeURIComponent(value)}`];
    parts.push(`Path=${options.path ?? "/"}`);
    if (options.maxAge !== undefined) {
        parts.push(`Max-Age=${Math.floor(options.maxAge)}`);
    }
    if (options.domain) {
        parts.push(`Domain=${options.domain}`);
    }
    if (options.secure) {
        parts.push("Secure");
    }
    if (options.httpOnly !== false) {
        parts.push("HttpOnly");
    }
    if (options.sameSite) {
        parts.push(`SameSite=${options.sameSite}`);
    }
    return parts.join("; ");
}
