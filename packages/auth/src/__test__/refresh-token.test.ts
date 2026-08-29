import { RefreshTokenStore } from "../refresh-token.store";

describe("RefreshTokenStore", () => {
    let store: RefreshTokenStore;

    beforeEach(() => {
        store = new RefreshTokenStore();
    });

    it("markUsed stores jti", () => {
        store.markUsed("jti-1", Date.now() + 10000);
        expect(store.isUsed("jti-1")).toBe(true);
    });

    it("markUsedIfAbsent returns true on first use", () => {
        expect(store.markUsedIfAbsent("jti-1", Date.now() + 10000)).toBe(true);
    });

    it("markUsedIfAbsent returns false on duplicate", () => {
        store.markUsedIfAbsent("jti-1", Date.now() + 10000);
        expect(store.markUsedIfAbsent("jti-1", Date.now() + 10000)).toBe(false);
    });

    it("isUsed returns false for unknown jti", () => {
        expect(store.isUsed("unknown")).toBe(false);
    });

    it("prunes expired tokens", () => {
        store.markUsed("expired-jti", Date.now() - 1000);
        expect(store.isUsed("expired-jti")).toBe(false);
    });

    it("does not prune non-expired tokens", () => {
        store.markUsed("valid-jti", Date.now() + 60000);
        expect(store.isUsed("valid-jti")).toBe(true);
    });
});
