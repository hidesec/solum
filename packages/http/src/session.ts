import { randomUUID } from "crypto";
import { CookieOptions, Session, SolumjsMiddleware } from "./http-types";

export interface SessionStore {
    get(id: string): Record<string, unknown> | undefined;
    set(id: string, data: Record<string, unknown>): void;
    destroy(id: string): void;
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
}

export function createSessionMiddleware(options: SessionOptions = {}): SolumjsMiddleware {
    const store = options.store ?? new MemorySessionStore(options.ttlMs);
    const cookieName = options.cookieName ?? "solum.sid";
    const cookieDefaults: Partial<CookieOptions> = { httpOnly: true, sameSite: "Lax", path: "/" };

    return (req, res, next) => {
        const cookies = req.cookies ?? {};
        const existingId = cookies[cookieName];
        const id = existingId ?? randomUUID();

        const storedData = existingId ? store.get(existingId) : undefined;
        const data: Record<string, unknown> = storedData ?? {};
        if (!storedData) {
            store.set(id, data);
        }

        let destroyed = false;

        const session: Session = {
            id,
            data,
            touch() {
                store.set(id, session.data);
            },
            destroy() {
                destroyed = true;
                store.destroy(id);
                if (!res.headersSent) {
                    res.clearCookie(cookieName, { ...cookieDefaults, ...options.cookie, maxAge: 0 });
                }
            },
        };

        req.session = session;

        if ((!existingId || !storedData) && !res.headersSent) {
            res.setCookie(cookieName, id, { ...cookieDefaults, ...options.cookie });
        }

        res.raw.on("finish", () => {
            if (!destroyed) {
                store.set(id, session.data);
            }
        });

        next();
    };
}
