import "../reflect-metadata";
import {
    Scope,
    Lazy,
    Primary,
    Order,
    Qualifier,
    ConditionalOnProperty,
    getBeanScope,
    isLazyBean,
    isPrimaryBean,
    getBeanOrder,
    getBeanName,
    buildConditionalPredicate,
    evaluateConditionalProperty,
} from "../bean-meta.decorators";

describe("bean-meta decorators and readers", () => {
    describe("Scope", () => {
        it("sets and reads bean scope", () => {
            @Scope("prototype")
            class TestClass {}
            expect(getBeanScope(TestClass)).toBe("prototype");
        });

        it("returns undefined for class without Scope", () => {
            class Plain {}
            expect(getBeanScope(Plain)).toBeUndefined();
        });
    });

    describe("Lazy", () => {
        it("marks bean as lazy", () => {
            @Lazy()
            class TestClass {}
            expect(isLazyBean(TestClass)).toBe(true);
        });

        it("returns false for non-lazy bean", () => {
            class Plain {}
            expect(isLazyBean(Plain)).toBe(false);
        });
    });

    describe("Primary", () => {
        it("marks bean as primary", () => {
            @Primary()
            class TestClass {}
            expect(isPrimaryBean(TestClass)).toBe(true);
        });

        it("returns false for non-primary bean", () => {
            class Plain {}
            expect(isPrimaryBean(Plain)).toBe(false);
        });
    });

    describe("Order", () => {
        it("sets and reads bean order", () => {
            @Order(10)
            class TestClass {}
            expect(getBeanOrder(TestClass)).toBe(10);
        });

        it("returns undefined for class without Order", () => {
            class Plain {}
            expect(getBeanOrder(Plain)).toBeUndefined();
        });
    });

    describe("Qualifier", () => {
        it("sets and reads bean name", () => {
            @Qualifier("myBean")
            class TestClass {}
            expect(getBeanName(TestClass)).toBe("myBean");
        });

        it("returns undefined for class without Qualifier", () => {
            class Plain {}
            expect(getBeanName(Plain)).toBeUndefined();
        });
    });

    describe("ConditionalOnProperty", () => {
        it("stores conditional metadata", () => {
            @ConditionalOnProperty({ property: "feature.enabled", havingValue: "true" })
            class TestClass {}
            const predicate = buildConditionalPredicate(TestClass);
            expect(typeof predicate).toBe("function");
        });

        it("returns undefined for class without ConditionalOnProperty", () => {
            class Plain {}
            expect(buildConditionalPredicate(Plain)).toBeUndefined();
        });
    });

    describe("evaluateConditionalProperty", () => {
        it("returns matchIfMissing when property undefined", () => {
            expect(evaluateConditionalProperty({ property: "nonexistent.prop", matchIfMissing: true })).toBe(true);
            expect(evaluateConditionalProperty({ property: "nonexistent.prop", matchIfMissing: false })).toBe(false);
            expect(evaluateConditionalProperty({ property: "nonexistent.prop" })).toBe(false);
        });

        it("returns true when havingValue matches", () => {
            process.env.TEST_COND_MATCH = "yes";
            expect(evaluateConditionalProperty({ property: "TEST_COND_MATCH", havingValue: "yes" })).toBe(true);
            expect(evaluateConditionalProperty({ property: "TEST_COND_MATCH", havingValue: "no" })).toBe(false);
            delete process.env.TEST_COND_MATCH;
        });

        it("evaluates truthy values without havingValue", () => {
            process.env.TEST_CONDTruthy = "true";
            expect(evaluateConditionalProperty({ property: "TEST_CONDTruthy" })).toBe(true);
            process.env.TEST_CONDTruthy = "1";
            expect(evaluateConditionalProperty({ property: "TEST_CONDTruthy" })).toBe(true);
            process.env.TEST_CONDTruthy = "false";
            expect(evaluateConditionalProperty({ property: "TEST_CONDTruthy" })).toBe(false);
            delete process.env.TEST_CONDTruthy;
        });
    });
});
