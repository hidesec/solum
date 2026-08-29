import { USER_ROLES } from "../roles";

describe("auth roles", () => {
    it("USER_ROLES contains USER and ADMIN", () => {
        expect(USER_ROLES).toContain("USER");
        expect(USER_ROLES).toContain("ADMIN");
        expect(USER_ROLES).toHaveLength(2);
    });

    it("USER_ROLES is readonly tuple", () => {
        expect(USER_ROLES[0]).toBe("USER");
        expect(USER_ROLES[1]).toBe("ADMIN");
    });
});
