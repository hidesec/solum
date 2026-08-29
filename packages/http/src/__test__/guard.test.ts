import {
    UseGuards,
    Roles,
    getClassGuards,
    getHandlerGuards,
    getRequiredRoles,
} from "../guard.decorator";

class MockGuard {
    canActivate = jest.fn().mockReturnValue(true);
}

describe("UseGuards decorator", () => {
    it("stores class-level guards", () => {
        @UseGuards(MockGuard)
        class TestClass {}
        const guards = getClassGuards(TestClass);
        expect(guards).toContain(MockGuard);
    });

    it("stores handler-level guards", () => {
        class TestClass {
            @UseGuards(MockGuard)
            doStuff() {}
        }
        const guards = getHandlerGuards(TestClass, "doStuff");
        expect(guards).toContain(MockGuard);
    });
});

describe("Roles decorator", () => {
    it("stores required roles", () => {
        class TestClass {
            @Roles("ADMIN")
            adminOnly() {}
        }
        const roles = getRequiredRoles(TestClass, "adminOnly");
        expect(roles).toContain("ADMIN");
    });

    it("stores multiple roles", () => {
        class TestClass {
            @Roles("ADMIN", "MANAGER")
            multiRole() {}
        }
        const roles = getRequiredRoles(TestClass, "multiRole");
        expect(roles).toEqual(["ADMIN", "MANAGER"]);
    });
});

describe("getClassGuards", () => {
    it("returns empty array for class without guards", () => {
        class Plain {}
        expect(getClassGuards(Plain)).toEqual([]);
    });
});

describe("getHandlerGuards", () => {
    it("returns empty array for method without guards", () => {
        class Plain {
            doStuff() {}
        }
        expect(getHandlerGuards(Plain, "doStuff")).toEqual([]);
    });
});

describe("getRequiredRoles", () => {
    it("returns empty array for method without roles", () => {
        class Plain {
            doStuff() {}
        }
        expect(getRequiredRoles(Plain, "doStuff")).toEqual([]);
    });
});
