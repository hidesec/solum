import { randomUUID, timingSafeEqual } from "crypto";
import { CookieOptions, Session, SolumjsMiddleware } from "./http-types";

export interface SessionStore {
    get(id: string): Record<string, unknown> | undefined;
    set(id: string, data: Record<string, unknown>): void;
    destroy(id: string): void;
    destroyAll(): void;
    regenerate(oldId: string, data: Record<string, unknown>): string;
}

export class MemorySessionStore implements SessionStore {
    private readonly sessions = new Map<string, { data: Record<string, unknown>; expiresAt: number }>();

    constructor(private readonly ttlMs: number = 24 * 60 * 60 * 1000) {}

    get(id: string): Record<string, unknown> | undefined {
        const entry = this.sessions.get(id);
        if (!entry) return undefined;
        if (entry.expiresAt < Date.now()) {
            this.sessions.delete(id);
            return undefined;
        }
        entry.expiresAt = Date.now() + this.ttlMs;
        return entry.data;
    }

    set(id: string, data: Record<string, unknown>): void {
        this.sessions.set(id, { data, expiresAt: Date.now() + this.ttlMs });
    }

    destroy(id: string): void {
        this.sessions.delete(id);
    }

    destroyAll(): void {
        this.sessions.clear();
    }

    regenerate(oldId: string, data: Record<string, unknown>): string {
        this.sessions.delete(oldId);
        const newId = randomUUID();
        this.sessions.set(newId, { data, expiresAt: Date.now() + this.ttlMs });
        return newId;
    }

    sweep(): number {
        const now = Date.now();
        let removed = 0;
        for (const [id, entry] of this.sessions) {
            if (entry.expiresAt < now) {
                this.sessions.delete(id);
                removed++;
            }
        }
        return removed;
    }

    get size(): number {
        return this.sessions.size;
    }
}

export interface SessionOptions {
    store?: SessionStore;
    cookieName?: string;
    ttlMs?: number;
    cookie?: Partial<CookieOptions>;
    fixationProtection?: boolean;
    maxAge?: number;
}

function safeSessionCompare(a: string, b: string): boolean {
    if (a.length !== b.length) return false;
    return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

export function createSessionMiddleware(options: SessionOptions = {}): SolumjsMiddleware {
    const store = options.store ?? new MemorySessionStore(options.ttlMs);
    const cookieName = options.cookieName ?? "solum.sid";
    const fixationProtection = options.fixationProtection ?? true;
    const cookieDefaults: Partial<CookieOptions> = { httpOnly: true, sameSite: "Lax", path: "/", secure: process.env.NODE_ENV === "production" };

    if (options.maxAge) {
        cookieDefaults.maxAge = options.maxAge;
    }

    return (req, res, next) => {
        const cookies = req.cookies ?? {};
        const existingId = cookies[cookieName];
        let id = existingId ?? randomUUID();
        let isNewSession = false;

        let storedData: Record<string, unknown> | undefined;
        if (existingId) {
            const data = store.get(existingId);
            if (data) {
                storedData = data;
            } else {
                isNewSession = true;
                id = randomUUID();
            }
        } else {
            isNewSession = true;
        }

        const data: Record<string, unknown> = storedData ?? {};
        if (isNewSession) {
            store.set(id, data);
        }

        let destroyed = false;
        let sessionId = id;

        const session: Session = {
            get id() { return sessionId; },
            data,
            touch() {
                store.set(sessionId, session.data);
            },
            destroy() {
                destroyed = true;
                store.destroy(sessionId);
                sessionId = "";
                if (!res.headersSent) {
                    res.clearCookie(cookieName, { ...cookieDefaults, ...options.cookie, maxAge: 0 });
                }
            },
            regenerate(): string {
                const oldId = sessionId;
                const newId = store.regenerate(oldId, session.data);
                sessionId = newId;
                if (!res.headersSent) {
                    res.clearCookie(cookieName, { ...cookieDefaults, ...options.cookie, maxAge: 0 });
                    res.setCookie(cookieName, newId, { ...cookieDefaults, ...options.cookie });
                }
                return newId;
            },
        };

        Object.defineProperty(req, "session", { value: session, writable: true, configurable: true });

        if (isNewSession && !res.headersSent) {
            res.setCookie(cookieName, id, { ...cookieDefaults, ...options.cookie });
        }

        res.raw.on("finish", () => {
            if (!destroyed) {
                store.set(sessionId, session.data);
            }
        });

        next();
    };
}

export function createLogoutMiddleware(cookieName: string = "solum.sid"): SolumjsMiddleware {
    return (req, _res, next) => {
        if (req.session) {
            req.session.destroy();
        }
        next();
    };
}

export function createFixationProtectionMiddleware(options: { loginPath?: string; cookieName?: string } = {}): SolumjsMiddleware {
    const loginPath = options.loginPath ?? "/login";

    return (req, res, next) => {
        if (req.method === "POST" && req.path === loginPath) {
            const originalEnd = res.raw.end.bind(res.raw);
            res.raw.end = function (...args: any[]) {
                const statusCode = res.raw.statusCode;
                if (statusCode >= 200 && statusCode < 300) {
                    if (req.session) {
                        req.session.regenerate();
                    }
                }
                return originalEnd(...args);
            };
        }
        next();
    };
}
