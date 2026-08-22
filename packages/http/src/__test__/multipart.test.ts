import { UploadedFile } from "../http-types";
import { extractBoundary, parseMultipart } from "../multipart";

function buildMultipartBody(): { body: Buffer; boundary: string } {
    const boundary = "----solumtest" + "1234";
    const fileContent = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0xff, 0x00, 0x11]);
    const parts: Buffer[] = [];

    parts.push(Buffer.from(`--${boundary}\r\n`));
    parts.push(Buffer.from('Content-Disposition: form-data; name="title"\r\n\r\n'));
    parts.push(Buffer.from("Hello World\r\n"));

    parts.push(Buffer.from(`--${boundary}\r\n`));
    parts.push(Buffer.from('Content-Disposition: form-data; name="tags"\r\n\r\n'));
    parts.push(Buffer.from("a,b,c\r\n"));

    parts.push(Buffer.from(`--${boundary}\r\n`));
    parts.push(
        Buffer.from(
            'Content-Disposition: form-data; name="document"; filename="report.bin"\r\n' +
                "Content-Type: application/octet-stream\r\n\r\n"
        )
    );
    parts.push(fileContent);
    parts.push(Buffer.from(`\r\n--${boundary}--\r\n`));

    return { body: Buffer.concat(parts), boundary };
}

describe("multipart", () => {
    it("extracts boundary from content-type header", () => {
        expect(extractBoundary('multipart/form-data; boundary=abc-123')).toBe("abc-123");
        expect(extractBoundary('multipart/form-data; boundary="quoted boundary"')).toBe("quoted boundary");
        expect(extractBoundary("application/json")).toBeUndefined();
        expect(extractBoundary(undefined)).toBeUndefined();
    });

    it("parses fields and binary files", () => {
        const { body, boundary } = buildMultipartBody();
        const result = parseMultipart(body, boundary);

        expect(result.fields).toEqual({ title: "Hello World", tags: "a,b,c" });
        expect(result.files).toHaveLength(1);

        const file: UploadedFile = result.files[0];
        expect(file.fieldname).toBe("document");
        expect(file.filename).toBe("report.bin");
        expect(file.mimeType).toBe("application/octet-stream");
        expect(file.size).toBe(7);
        expect(file.buffer.equals(Buffer.from([0x50, 0x4b, 0x03, 0x04, 0xff, 0x00, 0x11]))).toBe(true);
    });

    it("returns empty result when boundary not found", () => {
        const result = parseMultipart(Buffer.from("no multipart here"), "boundary");
        expect(result.fields).toEqual({});
        expect(result.files).toEqual([]);
    });
});
