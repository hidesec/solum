import { IsIn, IsString, MinLength } from "@solumjs/validation";
import { Get, Param, Query, RestController, Valid, HttpAdapter, RouteRegistration, SolumjsNext, SolumjsRequest, SolumjsResponse } from "@solumjs/http";
import { mountControllers } from "@solumjs/config";

class FilterDto {
    @IsIn(["name", "email"])
    field!: string;
}

class IdDto {
    @IsString()
    @MinLength(4)
    id!: string;
}

@RestController("/__valid-test")
class ValidTestController {
    @Get("/search")
    search(@Valid() @Query() filter: FilterDto): unknown {
        return { ok: true, filter };
    }

    @Get("/:id/detail")
    detail(@Valid() @Param() params: IdDto): unknown {
        return { ok: true, id: params };
    }
}

interface CapturedRoute {
    handler: (req: SolumjsRequest, res: SolumjsResponse, next: SolumjsNext) => Promise<void>;
}

function captureRoutes(): Map<string, CapturedRoute> {
    const routes = new Map<string, CapturedRoute>();
    const stub = {
        registerRoute(_prefix: string, registration: RouteRegistration) {
            routes.set(`${registration.method.toUpperCase()} ${registration.path}`, {
                handler: registration.handler as CapturedRoute["handler"],
            });
        },
    } as unknown as HttpAdapter;

    mountControllers(stub);
    return routes;
}

interface TestResponse extends SolumjsResponse {
    statusCode: number;
    body: unknown;
}

function fakeRes(): TestResponse {
    const res = {
        statusCode: 0,
        body: undefined as unknown,
        headersSent: false,
        raw: {},
        status(this: TestResponse, code: number) {
            this.statusCode = code;
            return this;
        },
        json(this: TestResponse, payload: unknown) {
            this.body = payload;
        },
        end() {},
    };
    return res as TestResponse;
}

function fakeReq(query: Record<string, string>, params: Record<string, string>): SolumjsRequest {
    return {
        method: "GET",
        path: "/__valid-test",
        params,
        query,
        headers: {},
        body: {},
        log: { info: () => {}, warn: () => {}, error: () => {} },
        raw: {},
    } as unknown as SolumjsRequest;
}

describe("@Valid pada @Query dan @Param", () => {
    const routes = captureRoutes();

    it("query valid lolos dan diteruskan sebagai instance DTO", async () => {
        const route = routes.get("GET /search");
        expect(route).toBeDefined();
        const res = fakeRes();
        await route!.handler(fakeReq({ field: "name" }, {}), res, () => {});
        expect(res.statusCode).toBe(200);
        expect(res.body).toEqual({ ok: true, filter: { field: "name" } });
    });

    it("query invalid ditolak 400 oleh exception advice", async () => {
        const route = routes.get("GET /search");
        const res = fakeRes();
        await route!.handler(fakeReq({ field: "hack" }, {}), res, () => {});
        expect(res.statusCode).toBe(400);
        expect((res.body as { message?: string }).message).toBeDefined();
    });

    it("@Param divalidasi lewat DTO", async () => {
        const route = routes.get("GET /:id/detail");
        expect(route).toBeDefined();

        const badRes = fakeRes();
        await route!.handler(fakeReq({}, { id: "abc" }), badRes, () => {});
        expect(badRes.statusCode).toBe(400);

        const okRes = fakeRes();
        await route!.handler(fakeReq({}, { id: "user-123" }), okRes, () => {});
        expect(okRes.body).toEqual({ ok: true, id: { id: "user-123" } });
    });
});
