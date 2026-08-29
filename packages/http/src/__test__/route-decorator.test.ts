import {
    SetApiVersionPrefix,
    GetApiVersionPrefix,
    ApiVersion,
    RestController,
    Get,
    Post,
    Put,
    Patch,
    Delete,
    getRoutesMetadata,
    getRegisteredControllers,
} from "../route.decorator";

describe("route decorators", () => {
    afterAll(() => {
        SetApiVersionPrefix("");
    });

    it("SetApiVersionPrefix and GetApiVersionPrefix", () => {
        SetApiVersionPrefix("/api/:version");
        expect(GetApiVersionPrefix()).toBe("/api/:version");
        SetApiVersionPrefix("");
    });

    it("Get returns default empty string", () => {
        SetApiVersionPrefix("");
        expect(GetApiVersionPrefix()).toBe("");
    });

    it("@Get decorator registers GET route", () => {
        @RestController("/users")
        class UsersController {
            @Get("/")
            list() {}

            @Get("/:id")
            findOne() {}
        }

        const routes = getRoutesMetadata(UsersController);
        expect(routes).toHaveLength(2);
        expect(routes[0].method).toBe("get");
        expect(routes[0].path).toBe("/");
        expect(routes[0].handlerName).toBe("list");
        expect(routes[1].method).toBe("get");
        expect(routes[1].path).toBe("/:id");
        expect(routes[1].handlerName).toBe("findOne");
    });

    it("@Post decorator registers POST route", () => {
        @RestController("/items")
        class ItemsController {
            @Post("/")
            create() {}
        }

        const routes = getRoutesMetadata(ItemsController);
        expect(routes).toHaveLength(1);
        expect(routes[0].method).toBe("post");
        expect(routes[0].path).toBe("/");
    });

    it("@Put decorator registers PUT route", () => {
        @RestController("/items")
        class ItemsController {
            @Put("/:id")
            update() {}
        }

        const routes = getRoutesMetadata(ItemsController);
        expect(routes[0].method).toBe("put");
    });

    it("@Patch decorator registers PATCH route", () => {
        @RestController("/items")
        class ItemsController {
            @Patch("/:id")
            patch() {}
        }

        const routes = getRoutesMetadata(ItemsController);
        expect(routes[0].method).toBe("patch");
    });

    it("@Delete decorator registers DELETE route", () => {
        @RestController("/items")
        class ItemsController {
            @Delete("/:id")
            remove() {}
        }

        const routes = getRoutesMetadata(ItemsController);
        expect(routes[0].method).toBe("delete");
    });

    it("decorator with MappingOptions string path", () => {
        @RestController("/test")
        class TestController {
            @Get("/custom")
            custom() {}
        }

        const routes = getRoutesMetadata(TestController);
        expect(routes[0].path).toBe("/custom");
    });

    it("decorator with MappingOptions object", () => {
        @RestController("/test")
        class TestController {
            @Get({ path: "/filtered", produces: ["application/json"], consumes: ["application/json"] })
            filtered() {}
        }

        const routes = getRoutesMetadata(TestController);
        expect(routes[0].path).toBe("/filtered");
        expect(routes[0].produces).toEqual(["application/json"]);
        expect(routes[0].consumes).toEqual(["application/json"]);
    });

    it("decorator with version in MappingOptions", () => {
        @RestController("/test")
        class TestController {
            @Get({ path: "/v2", version: "2" })
            v2() {}
        }

        const routes = getRoutesMetadata(TestController);
        expect(routes[0].version).toBe("2");
    });

    it("@ApiVersion decorator sets version on controller", () => {
        @ApiVersion("v1")
        @RestController("/api")
        class VersionedController {
            @Get("/")
            list() {}
        }

        const controllers = getRegisteredControllers();
        const found = controllers.find((c) => c.target === VersionedController);
        expect(found).toBeDefined();
        expect(found!.version).toBe("v1");
    });

    it("@RestController registers controller with prefix", () => {
        @RestController("/admin")
        class AdminController {
            @Get("/")
            dashboard() {}
        }

        const controllers = getRegisteredControllers();
        const found = controllers.find((c) => c.target === AdminController);
        expect(found).toBeDefined();
        expect(found!.prefix).toBe("/admin");
    });

    it("@RestController defaults prefix to /", () => {
        @RestController()
        class DefaultController {
            @Get("/")
            index() {}
        }

        const controllers = getRegisteredControllers();
        const found = controllers.find((c) => c.target === DefaultController);
        expect(found).toBeDefined();
        expect(found!.prefix).toBe("/");
    });

    it("returns empty array for class with no routes", () => {
        class EmptyController {}
        const routes = getRoutesMetadata(EmptyController);
        expect(routes).toEqual([]);
    });
});
