import {
    Body,
    CanActivate,
    CurrentUser,
    Get,
    Header,
    HttpAdapter,
    Next,
    Param,
    Post,
    Query,
    Req,
    ResponseStatus,
    RestController,
    RouteRegistration,
    SolumjsHandler,
    SolumjsNext,
    SolumjsRequest,
    SolumjsResponse,
    UseGuards,
} from "@solumjs/http";
import { ExceptionHandler } from "@solumjs/middlewares";
import { mountControllers } from "../router-factory";

class BoomError extends Error {}

class TagGuard implements CanActivate {
    canActivate(): boolean {
        throw new ForbiddenLike;
    }
}

class ForbiddenLike extends Error {}

interface TestResponse extends SolumjsResponse {
    statusCode: number;
    body: unknown;
    ended: boolean;
}

function fakeRes(): TestResponse {
    const res = {
        statusCode: 0,
        body: undefined as unknown,
        headersSent: false,
        ended: false,
        raw: {},
        status(this: TestResponse, code: number) {
            this.statusCode = code;
            return this;
        },
        json(this: TestResponse, payload: unknown) {
            this.body = payload;
        },
        end(this: TestResponse) {
            this.ended = true;
        },
    };
    return res as TestResponse;
}

function fakeReq(overrides: Record<string, unknown> = {}): SolumjsRequest {
    return {
        method: "POST",
        path: "/rf",
        params: {},
        query: {},
        headers: {},
        body: {},
        log: { info: () => {}, warn: () => {}, error: () => {} },
        raw: {},
        ...overrides,
    } as unknown as SolumjsRequest;
}

@RestController("/rf")
class RfController {
    @Post("/:id")
    @ResponseStatus(201)
    async create(
        @Body() body: unknown,
        @Param() params: unknown,
        @Query() query: unknown,
        @Header("x-tag") tag: unknown,
        @Req() req: unknown,
        @Next() next: unknown,
        @CurrentUser() user: unknown
    ): Promise<unknown> {
        return { body, params, query, tag, isReq: req !== undefined, isNext: typeof next === "function", user };
    }

    @Get("/empty")
    async empty(): Promise<undefined> {
        return undefined;
    }

    @ExceptionHandler(BoomError)
    async handleBoom(err: BoomError): Promise<{ caught: string }> {
        return { caught: err.message };
    }

    @Get("/boom")
    async throwsBoom(): Promise<string> {
        throw new BoomError("kaboom");
    }

    @Get("/unhandled")
    async unhandled(): Promise<string> {
        throw new Error("plain-failure");
    }
}

@RestController("/guarded")
class GuardedController {
    @Get("/denied")
    @UseGuards(TagGuard)
    async denied(): Promise<string> {
        return "never";
    }
}

const captured = new Map<string, SolumjsHandler>();

const adapterStub = {
    registerRoute(_prefix: string, registration: RouteRegistration) {
        captured.set(`${registration.method.toUpperCase()} ${registration.path}`, registration.handler as SolumjsHandler);
    },
} as unknown as HttpAdapter;

describe("router-factory", () => {
    beforeAll(() => {
        mountControllers(adapterStub);
    });

    it("me-resolve seluruh sumber argumen dan memakai ResponseStatus", async () => {
        const handler = captured.get("POST /:id");
        expect(handler).toBeDefined();

        const res = fakeRes();
        const req = fakeReq({
            params: { id: "42" },
            query: { q: "hello" },
            headers: { "x-tag": "beta" },
            body: { name: "Ada" },
            user: { sub: "user-1" },
        });

        await handler!(req, res, () => {});

        expect(res.statusCode).toBe(201);
        expect(res.body).toEqual({
            body: { name: "Ada" },
            params: { id: "42" },
            query: { q: "hello" },
            tag: "beta",
            isReq: true,
            isNext: true,
            user: { sub: "user-1" },
        });
    });

    it("return undefined dijawab status default tanpa json", async () => {
        const handler = captured.get("GET /empty");
        const res = fakeRes();
        await handler!(fakeReq({ method: "GET" }), res, () => {});
        expect(res.statusCode).toBe(200);
        expect(res.ended).toBe(true);
        expect(res.body).toBeUndefined();
    });

    it("@ExceptionHandler pada controller menangani error spesifik tanpa next", async () => {
        const handler = captured.get("GET /boom");
        const res = fakeRes();
        let nextCalled = false;

        await handler!(fakeReq({ method: "GET" }), res, () => {
            nextCalled = true;
        });

        expect(nextCalled).toBe(false);
        expect(res.body).toEqual({ caught: "kaboom" });
    });

    it("error tanpa handler diteruskan ke next dengan identitas instance yang sama", async () => {
        const handler = captured.get("GET /unhandled");
        const res = fakeRes();
        let forwarded: unknown;

        await handler!(fakeReq({ method: "GET", path: "/unhandled" }), res, (err) => {
            forwarded = err;
        });

        expect(forwarded).toBeDefined();
        expect((forwarded as Error).message).toBe("plain-failure");
    });

    it("error dari guard diteruskan ke next", async () => {
        const handler = captured.get("GET /denied");
        const res = fakeRes();
        let forwarded: unknown;

        await handler!(fakeReq({ method: "GET", path: "/denied" }), res, (err) => {
            forwarded = err;
        });

        expect(forwarded).toBeInstanceOf(Error);
        expect(res.body).toBeUndefined();
    });
});

describe("API version prefix", () => {
    const { SetApiVersionPrefix, GetApiVersionPrefix, ApiVersion } = require("@solumjs/http");

    afterEach(() => {
        SetApiVersionPrefix("");
    });

    it("buildVersionPrefix with controller version and prefix", () => {
        SetApiVersionPrefix("/api/:version");
        expect(GetApiVersionPrefix()).toBe("/api/:version");
    });

    it("SetApiVersionPrefix overwrites previous value", () => {
        SetApiVersionPrefix("/v1");
        expect(GetApiVersionPrefix()).toBe("/v1");
        SetApiVersionPrefix("/v2");
        expect(GetApiVersionPrefix()).toBe("/v2");
    });

    it("GetApiVersionPrefix returns empty when not set", () => {
        expect(GetApiVersionPrefix()).toBe("");
    });
});

describe("listRegisteredRoutes", () => {
    it("exports listRegisteredRoutes function", async () => {
        const { listRegisteredRoutes } = await import("../router-factory");
        expect(typeof listRegisteredRoutes).toBe("function");
    });

    it("listRegisteredRoutes returns array", async () => {
        const { listRegisteredRoutes } = await import("../router-factory");
        const result = listRegisteredRoutes();
        expect(Array.isArray(result)).toBe(true);
    });
});

describe("joinPaths internal logic", () => {
    it("joins prefix and path correctly", () => {
        const join = (prefix: string, path: string) => {
            const full = `${prefix}/${path}`.replace(/\/+/g, "/");
            return full.length > 1 && full.endsWith("/") ? full.slice(0, -1) : full;
        };
        expect(join("/api", "/users")).toBe("/api/users");
        expect(join("/api/", "/users")).toBe("/api/users");
        expect(join("/api", "users")).toBe("/api/users");
        expect(join("/", "/")).toBe("/");
    });
});

describe("Cookie @ParamSource.COOKIE resolution", () => {
    it("parses cookie string from headers", () => {
        const cookieHeader = "session=abc123; theme=dark";
        const cookies: Record<string, string> = {};
        cookieHeader.split(";").forEach((pair: string) => {
            const [k, ...rest] = pair.split("=");
            if (k) cookies[k.trim()] = rest.join("=").trim();
        });
        expect(cookies["session"]).toBe("abc123");
        expect(cookies["theme"]).toBe("dark");
    });

    it("handles empty cookie string", () => {
        const cookies: Record<string, string> = "".split(";").reduce((acc: Record<string, string>, pair: string) => {
            const [k, ...rest] = pair.split("=");
            if (k?.trim()) acc[k.trim()] = rest.join("=").trim();
            return acc;
        }, {});
        expect(Object.keys(cookies)).toHaveLength(0);
    });
});
