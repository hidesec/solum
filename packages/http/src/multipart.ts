import { UploadedFile } from "./http-types";

export interface MultipartResult {
    fields: Record<string, string>;
    files: UploadedFile[];
}

function findSequence(haystack: Buffer, needle: Buffer, from: number): number {
    return haystack.indexOf(needle, from);
}

export function extractBoundary(contentType: string | undefined): string | undefined {
    if (!contentType || !contentType.toLowerCase().includes("multipart/form-data")) return undefined;
    const match = /boundary=(?:"([^"]+)"|([^;,\s]+))/i.exec(contentType);
    if (!match) return undefined;
    return (match[1] ?? match[2]).trim();
}

export function parseMultipart(buffer: Buffer, boundary: string): MultipartResult {
    const result: MultipartResult = { fields: {}, files: [] };
    const delimiter = Buffer.from(`--${boundary}`);

    let position = findSequence(buffer, delimiter, 0);
    if (position === -1) return result;

    position += delimiter.length;

    while (position < buffer.length) {
        if (buffer[position] === 0x2d && buffer[position + 1] === 0x2d) break;
        if (buffer[position] === 0x0d && buffer[position + 1] === 0x0a) {
            position += 2;
        } else {
            const lineEnd = findSequence(buffer, CRLF, position);
            if (lineEnd === -1) break;
            position = lineEnd + 2;
        }

        const headersEnd = findSequence(buffer, DOUBLE_CRLF, position);
        if (headersEnd === -1) break;

        const headerBlock = buffer.subarray(position, headersEnd).toString("utf8");
        const bodyStart = headersEnd + DOUBLE_CRLF.length;
        const nextDelimiter = findSequence(buffer, delimiter, bodyStart);
        if (nextDelimiter === -1) break;

        let bodyEnd = nextDelimiter;
        if (buffer[bodyEnd - 2] === 0x0d && buffer[bodyEnd - 1] === 0x0a) {
            bodyEnd -= 2;
        }
        const partBody = buffer.subarray(bodyStart, bodyEnd);

        applyPart(result, headerBlock, partBody);

        position = nextDelimiter + delimiter.length;
    }

    return result;
}

const CRLF = Buffer.from("\r\n");
const DOUBLE_CRLF = Buffer.from("\r\n\r\n");

function sanitizeFilename(filename: string): string {
    const base = filename.split(/[/\\]/).pop() ?? filename;
    return base.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 255);
}

function applyPart(result: MultipartResult, headerBlock: string, body: Buffer): void {
    const headers = parsePartHeaders(headerBlock);
    const disposition = headers["content-disposition"] ?? "";
    const name = /name="((?:[^"\\]|\\.)*)"/.exec(disposition)?.[1];
    const rawFilename = /filename="((?:[^"\\]|\\.)*)"/.exec(disposition)?.[1];

    if (!name) return;

    if (rawFilename !== undefined) {
        result.files.push({
            fieldname: name,
            filename: sanitizeFilename(rawFilename),
            encoding: (headers["content-transfer-encoding"] ?? "binary").trim(),
            mimeType: (headers["content-type"] ?? "application/octet-stream").split(";")[0].trim(),
            buffer: Buffer.from(body),
            size: body.length,
        });
        return;
    }

    result.fields[name] = body.toString("utf8");
}

function parsePartHeaders(block: string): Record<string, string> {
    const headers: Record<string, string> = {};
    for (const line of block.split("\r\n")) {
        const separator = line.indexOf(":");
        if (separator === -1) continue;
        headers[line.slice(0, separator).trim().toLowerCase()] = line.slice(separator + 1).trim();
    }
    return headers;
}
