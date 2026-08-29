import "../reflect-metadata";
import { Profile, getProfileCondition, matchesActiveProfile, getActiveProfiles } from "../profile.decorator";

describe("Profile decorator and helpers", () => {
    const originalEnv = process.env.NODE_ENV;

    afterEach(() => {
        if (originalEnv !== undefined) {
            process.env.NODE_ENV = originalEnv;
        } else {
            delete process.env.NODE_ENV;
        }
    });

    describe("getActiveProfiles", () => {
        it("returns NODE_ENV split by comma", () => {
            process.env.NODE_ENV = "development";
            expect(getActiveProfiles()).toEqual(["development"]);
        });

        it("handles multiple profiles", () => {
            process.env.NODE_ENV = "production, cloud";
            expect(getActiveProfiles()).toEqual(["production", "cloud"]);
        });

        it("defaults to development", () => {
            delete process.env.NODE_ENV;
            expect(getActiveProfiles()).toEqual(["development"]);
        });
    });

    describe("matchesActiveProfile", () => {
        it("returns true when profile matches", () => {
            process.env.NODE_ENV = "production";
            expect(matchesActiveProfile(["production"])).toBe(true);
        });

        it("returns false when no profile matches", () => {
            process.env.NODE_ENV = "development";
            expect(matchesActiveProfile(["production"])).toBe(false);
        });

        it("returns true if any profile matches", () => {
            process.env.NODE_ENV = "staging";
            expect(matchesActiveProfile(["production", "staging"])).toBe(true);
        });
    });

    describe("getProfileCondition", () => {
        it("returns predicate when @Profile is set", () => {
            @Profile("production")
            class ProdClass {}
            const predicate = getProfileCondition(ProdClass);
            expect(typeof predicate).toBe("function");
        });

        it("returns undefined when no @Profile", () => {
            class Plain {}
            expect(getProfileCondition(Plain)).toBeUndefined();
        });

        it("predicate checks against active profiles", () => {
            @Profile("production")
            class ProdClass {}
            const predicate = getProfileCondition(ProdClass)!;

            process.env.NODE_ENV = "production";
            expect(predicate()).toBe(true);

            process.env.NODE_ENV = "development";
            expect(predicate()).toBe(false);
        });
    });
});
