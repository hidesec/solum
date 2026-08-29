import { objectToXml } from "../xml";

describe("xml", () => {
    it("converts simple object to XML", () => {
        const result = objectToXml({ name: "John", age: 30 });
        expect(result).toContain('<?xml version="1.0" encoding="UTF-8"?>');
        expect(result).toContain("<response>");
        expect(result).toContain("<name>John</name>");
        expect(result).toContain("<age>30</age>");
    });

    it("escapes XML special characters", () => {
        const result = objectToXml({ text: '<script>alert("xss")</script>' });
        expect(result).toContain("&lt;script&gt;");
        expect(result).not.toContain("<script>");
    });

    it("escapes ampersand, quotes, and apostrophes", () => {
        const result = objectToXml({ val: 'a&b "c" \'d\'' });
        expect(result).toContain("&amp;");
        expect(result).toContain("&quot;");
        expect(result).toContain("&apos;");
    });

    it("uses custom root tag", () => {
        const result = objectToXml({ id: 1 }, "user");
        expect(result).toContain("<user>");
        expect(result).toContain("</user>");
    });

    it("sanitizes unsafe root tag names", () => {
        const result = objectToXml({ id: 1 }, '<!DOCTYPE foo>');
        expect(result).not.toContain("<!DOCTYPE");
        expect(result).toContain("<id>1</id>");
    });

    it("sanitizes root tag with special characters", () => {
        const result = objectToXml({ id: 1 }, "user@data");
        expect(result).toContain("<user_data>");
    });

    it("handles nested objects", () => {
        const result = objectToXml({ user: { name: "John", address: { city: "NYC" } } });
        expect(result).toContain("<user>");
        expect(result).toContain("<name>John</name>");
        expect(result).toContain("<city>NYC</city>");
    });

    it("handles arrays", () => {
        const result = objectToXml({ items: [1, 2, 3] });
        expect(result).toContain("<list>");
        expect(result).toContain("<item>");
    });

    it("handles null and undefined values", () => {
        const result = objectToXml({ a: null, b: undefined });
        expect(result).toContain("<null/>");
    });

    it("handles boolean values", () => {
        const result = objectToXml({ active: true, deleted: false });
        expect(result).toContain("true");
        expect(result).toContain("false");
    });

    it("handles number values", () => {
        const result = objectToXml({ count: 42, price: 9.99 });
        expect(result).toContain("<count>42</count>");
        expect(result).toContain("<price>9.99</price>");
    });

    it("converts array at root level", () => {
        const result = objectToXml([{ id: 1 }, { id: 2 }]);
        expect(result).toContain("<list>");
        expect(result).toContain("<item>");
        expect(result).toContain("<id>1</id>");
        expect(result).toContain("<id>2</id>");
    });

    it("sanitizes object keys with special characters", () => {
        const result = objectToXml({ "user-name": "John", "data@key": "value" });
        expect(result).toContain("<user_name>");
        expect(result).toContain("<data_key>");
    });

    it("handles empty object", () => {
        const result = objectToXml({});
        expect(result).toContain('<?xml version="1.0" encoding="UTF-8"?>');
        expect(result).toContain("<response>");
    });

    it("rejects script injection in root tag", () => {
        const result = objectToXml({ x: 1 }, '"><script>');
        expect(result).not.toContain("<script>");
        expect(result).toContain("<x>1</x>");
    });
});
