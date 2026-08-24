import {
    parseFieldForTest,
    parseCronForTest,
    parseIntervalMsForTest,
    nextCronDateForTest,
    isCronForTest,
} from "../scheduler";

describe("parseField", () => {
    test("parses wildcard", () => {
        const result = parseFieldForTest("*", 0, 59);
        expect(result.size).toBe(60);
        expect(result.has(0)).toBe(true);
        expect(result.has(59)).toBe(true);
    });

    test("parses single value", () => {
        const result = parseFieldForTest("5", 0, 59);
        expect(result.size).toBe(1);
        expect(result.has(5)).toBe(true);
    });

    test("parses range", () => {
        const result = parseFieldForTest("1-5", 0, 59);
        expect(result.size).toBe(5);
        expect(result.has(1)).toBe(true);
        expect(result.has(5)).toBe(true);
        expect(result.has(0)).toBe(false);
    });

    test("parses step", () => {
        const result = parseFieldForTest("*/15", 0, 59);
        expect(result.size).toBe(4);
        expect(result.has(0)).toBe(true);
        expect(result.has(15)).toBe(true);
        expect(result.has(30)).toBe(true);
        expect(result.has(45)).toBe(true);
    });

    test("parses comma-separated values", () => {
        const result = parseFieldForTest("1,3,5", 0, 59);
        expect(result.size).toBe(3);
        expect(result.has(1)).toBe(true);
        expect(result.has(3)).toBe(true);
        expect(result.has(5)).toBe(true);
    });

    test("parses range with step", () => {
        const result = parseFieldForTest("1-10/2", 0, 59);
        expect(result.size).toBe(5);
        expect(result.has(1)).toBe(true);
        expect(result.has(3)).toBe(true);
        expect(result.has(5)).toBe(true);
        expect(result.has(7)).toBe(true);
        expect(result.has(9)).toBe(true);
    });

    test("throws on invalid step", () => {
        expect(() => parseFieldForTest("*/0", 0, 59)).toThrow("Invalid step");
        expect(() => parseFieldForTest("*/-1", 0, 59)).toThrow("Invalid step");
    });

    test("throws on out of range value", () => {
        expect(() => parseFieldForTest("60", 0, 59)).toThrow("Invalid cron field");
        expect(() => parseFieldForTest("-1", 0, 59)).toThrow("Invalid cron field");
    });
});

describe("parseCron", () => {
    test("parses standard 5-field expression", () => {
        const result = parseCronForTest("*/5 * * * *");
        expect(result.minutes.size).toBe(12);
        expect(result.hours.size).toBe(24);
        expect(result.daysOfMonth.size).toBe(31);
        expect(result.months.size).toBe(12);
        expect(result.daysOfWeek.size).toBe(7);
    });

    test("parses every minute", () => {
        const result = parseCronForTest("* * * * *");
        expect(result.minutes.size).toBe(60);
        expect(result.hours.size).toBe(24);
    });

    test("throws on invalid number of fields", () => {
        expect(() => parseCronForTest("* * *")).toThrow("expected 5 fields");
        expect(() => parseCronForTest("* * * * * *")).toThrow("expected 5 fields");
    });

    test("throws on invalid field", () => {
        expect(() => parseCronForTest("60 * * * *")).toThrow("Invalid cron field");
    });
});

describe("parseIntervalMs", () => {
    test("parses milliseconds", () => {
        expect(parseIntervalMsForTest("500ms")).toBe(500);
    });

    test("parses seconds", () => {
        expect(parseIntervalMsForTest("30s")).toBe(30000);
    });

    test("parses minutes", () => {
        expect(parseIntervalMsForTest("5m")).toBe(300000);
    });

    test("parses hours", () => {
        expect(parseIntervalMsForTest("1h")).toBe(3600000);
    });

    test("throws on invalid format", () => {
        expect(() => parseIntervalMsForTest("5x")).toThrow("Invalid interval");
        expect(() => parseIntervalMsForTest("abc")).toThrow("Invalid interval");
    });
});

describe("isCron", () => {
    test("returns true for 5-field expression", () => {
        expect(isCronForTest("* * * * *")).toBe(true);
        expect(isCronForTest("0 12 * * *")).toBe(true);
    });

    test("returns false for interval expression", () => {
        expect(isCronForTest("5m")).toBe(false);
        expect(isCronForTest("30s")).toBe(false);
    });
});

describe("nextCronDate", () => {
    test("returns next matching minute", () => {
        const fields = parseCronForTest("0 * * * *");
        const from = new Date(2024, 0, 1, 0, 30);
        const next = nextCronDateForTest(fields, from);
        expect(next.getHours()).toBe(1);
        expect(next.getMinutes()).toBe(0);
    });

    test("returns next day when hour has passed", () => {
        const fields = parseCronForTest("0 12 * * *");
        const from = new Date(2024, 0, 1, 13, 0);
        const next = nextCronDateForTest(fields, from);
        expect(next.getDate()).toBe(2);
        expect(next.getHours()).toBe(12);
        expect(next.getMinutes()).toBe(0);
    });

    test("returns next matching day of week", () => {
        const fields = parseCronForTest("0 0 * * 1");
        const from = new Date(2024, 0, 3, 0, 0);
        const next = nextCronDateForTest(fields, from);
        expect(next.getDay()).toBe(1);
    });
});