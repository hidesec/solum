import { Body, Get, HttpAdapter, Param, Post, Query, RestController, RouteRegistration, Valid } from "@solumjs/http";
import { IsInt, IsOptional, IsString, Max, Min, MinLength } from "@solumjs/validation";
import { buildDtoSchema, buildOpenApiSpec, mountOpenApi } from "../openapi";

class CreateUserDto {
    @IsString()
    @MinLength(2)
    name!: string;

    @IsInt()
    @Min(1)
    @Max(120)
    age!: number;

    @IsOptional()
    @IsString()
    nickname?: string;
}

@RestController("/pets")
class PetController {
    @Get("/:id")
    async findOne(@Param("id") id: string): Promise<unknown> {
        return { id };
    }

    @Get()
    async search(@Query("q") q: string): Promise<unknown> {
        return { q };
    }

    @Post()
    async create(@Body() @Valid() dto: CreateUserDto): Promise<unknown> {
        return dto;
    }
}

describe("openapi", () => {
    it("builds a DTO schema from validation metadata", () => {
        const schema = buildDtoSchema(CreateUserDto) as any;

        expect(schema.type).toBe("object");
        expect(schema.required).toEqual(["age", "name"]);
        expect(schema.properties.name).toEqual({ type: "string", minLength: 2 });
        expect(schema.properties.age).toEqual({ type: "integer", minimum: 1, maximum: 120 });
        expect(schema.properties.nickname).toEqual({ type: "string" });
    });

    it("builds a spec with paths, parameters and request bodies", () => {
        const spec = buildOpenApiSpec({ title: "Test API", version: "2.0.0" }) as any;

        expect(spec.openapi).toBe("3.0.3");
        expect(spec.info).toMatchObject({ title: "Test API", version: "2.0.0" });

        const findPath = spec.paths["/pets/{id}"];
        expect(findPath.get.operationId).toBe("PetController_findOne");
        expect(findPath.get.tags).toEqual(["PetController"]);
        expect(findPath.get.parameters).toContainEqual({
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
        });

        expect(spec.paths["/pets"].get.parameters).toContainEqual({
            name: "q",
            in: "query",
            required: false,
            schema: { type: "string" },
        });

        const create = spec.paths["/pets"].post;
        expect(create.requestBody.content["application/json"].schema.$ref).toBe(
            "#/components/schemas/CreateUserDto"
        );
        expect(spec.components.schemas.CreateUserDto.properties.name.minLength).toBe(2);
    });

    it("mountOpenApi registers spec and docs routes on the adapter", () => {
        const registered: RouteRegistration[] = [];
        const adapter = {
            registerRoute(_prefix: string, route: RouteRegistration) {
                registered.push(route);
            },
        } as unknown as HttpAdapter;

        mountOpenApi(adapter, { specPath: "/spec.json", docsPath: "/docs" });

        expect(registered.map((r) => `${r.method.toUpperCase()} ${r.path}`)).toEqual([
            "GET /spec.json",
            "GET /docs",
        ]);

        for (const route of registered) {
            expect(typeof route.handler).toBe("function");
        }
    });
});
