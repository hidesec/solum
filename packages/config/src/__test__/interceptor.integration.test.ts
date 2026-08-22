import { Get, Post, RestController, addInterceptors, resetInterceptors } from "@solumjs/http";
import { createApplication, SolumApplication } from "../application";

const calls: string[] = [];

class AuditInterceptor {
    preHandle(): boolean {
        calls.push("audit:pre");
        return true;
    }
    postHandle(): void {
        calls.push("audit:post");
    }
    afterCompletion(_req: unknown, _res: unknown, error?: unknown): void {
        calls.push(error ? "audit:error" : "audit:done");
    }
}

class BlockingInterceptor {
    preHandle(): boolean {
        calls.push("blocker:pre");
        return false;
    }
    postHandle(): void {
        calls.push("blocker:post");
    }
    afterCompletion(): void {
        calls.push("blocker:done");
    }
}

@RestController("/it")
class ItController {
    @Get("/plain")
    async plain(): Promise<unknown> {
        calls.push("handler");
        return { ok: true };
    }

    @Post("/fail")
    async fail(): Promise<unknown> {
        throw new Error("boom");
    }
}

describe("interceptor integration", () => {
    let app: SolumApplication;
    let url: string;

    beforeEach(() => {
        calls.length = 0;
        resetInterceptors();
        addInterceptors(AuditInterceptor);
    });

    afterEach(async () => {
        await app?.shutdown();
    });

    it("runs pre, handler, reverse post and completion hooks in order", async () => {
        app = await createApplication({ autoDatabase: false, autoCache: false, autoMongo: false, docs: false, port: 0 });
        const address = app.server.address();
        const port = typeof address === "object" && address ? address.port : 0;
        url = `http://127.0.0.1:${port}`;

        const response = await fetch(`${url}/it/plain`);
        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({ ok: true });

        expect(calls).toEqual(["audit:pre", "handler", "audit:post", "audit:done"]);
    });

    it("short-circuits on preHandle=false and skips handler and postHandle", async () => {
        resetInterceptors();
        addInterceptors(AuditInterceptor);
        addInterceptors(BlockingInterceptor, { patterns: ["/it/fail"] });

        app = await createApplication({ autoDatabase: false, autoCache: false, autoMongo: false, docs: false, port: 0 });
        const address = app.server.address();
        const port = typeof address === "object" && address ? address.port : 0;
        url = `http://127.0.0.1:${port}`;

        const response = await fetch(`${url}/it/fail`, { method: "POST" });

        expect(response.status).toBe(204);
        expect(calls).toEqual(["audit:pre", "blocker:pre", "audit:done", "blocker:done"]);
    });

    it("reports errors to afterCompletion", async () => {
        app = await createApplication({ autoDatabase: false, autoCache: false, autoMongo: false, docs: false, port: 0 });
        const address = app.server.address();
        const port = typeof address === "object" && address ? address.port : 0;
        url = `http://127.0.0.1:${port}`;

        resetInterceptors();
        addInterceptors({
            afterCompletion(_req, _res, error) {
                calls.push(`completion:${error instanceof Error ? error.message : "none"}`);
            },
        });

        const response = await fetch(`${url}/it/fail`, { method: "POST" });
        expect(response.status).toBe(500);
        expect(calls).toContain("completion:boom");
    });
});
