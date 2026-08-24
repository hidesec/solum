import { createReadStream, existsSync, lstatSync, statSync } from "fs";
import path from "path";
import { SolumjsMiddleware } from "./http-types";
import { normalizePath } from "./normalize";

const CONTENT_TYPES: Record<string, string> = {
    ".html": "text/html; charset=utf-8",
    ".htm": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".mjs": "application/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".txt": "text/plain; charset=utf-8",
    ".xml": "application/xml; charset=utf-8",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".svg": "image/svg+xml",
    ".webp": "image/webp",
    ".ico": "image/x-icon",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
    ".ttf": "font/ttf",
    ".otf": "font/otf",
    ".eot": "application/vnd.ms-fontobject",
    ".mp3": "audio/mpeg",
    ".mp4": "video/mp4",
    ".webm": "video/webm",
    ".pdf": "application/pdf",
    ".wasm": "application/wasm",
    ".map": "application/json",
};

export interface StaticOptions {
    prefix?: string;
    index?: string;
    maxAgeSeconds?: number;
    fallthrough?: boolean;
}

export function serveStatic(rootDir: string, options: StaticOptions = {}): SolumjsMiddleware {
    const prefix = options.prefix ?? "/static";
    const indexFile = options.index ?? "index.html";
    const maxAge = options.maxAgeSeconds ?? 0;
    const fallthrough = options.fallthrough ?? true;
    const normalizedPrefix = normalizePath(prefix);
    const rootAbs = path.resolve(rootDir);

    return (req, res, next) => {
        if (!["GET", "HEAD"].includes(req.method)) {
            next();
            return;
        }

        if (normalizedPrefix !== "/" && !(req.path === normalizedPrefix || req.path.startsWith(`${normalizedPrefix}/`))) {
            next();
            return;
        }

        let relative: string;
        if (normalizedPrefix === "/") {
            relative = req.path.slice(1);
        } else {
            relative = req.path === normalizedPrefix ? "" : req.path.slice(normalizedPrefix.length + 1);
        }
        if (relative === "") relative = indexFile;

        const resolvedRootWithTrailing = rootAbs.endsWith(path.sep) ? rootAbs : rootAbs + path.sep;
        const target = path.resolve(rootAbs, decodeURIComponent(relative));

        if (!target.startsWith(resolvedRootWithTrailing) && target !== rootAbs) {
            next();
            return;
        }

        let stats;
        try {
            const linkStats = lstatSync(target);
            if (linkStats.isSymbolicLink()) {
                if (fallthrough) {
                    next();
                    return;
                }
                res.status(403).json({ status: "error", message: "Forbidden" });
                return;
            }
            stats = statSync(target);
        } catch {
            if (fallthrough) {
                next();
                return;
            }
            res.status(404).json({ status: "error", message: "Not found" });
            return;
        }

        if (stats.isDirectory()) {
            next();
            return;
        }

        if (!existsSync(target)) {
            next();
            return;
        }

        const extension = path.extname(target).toLowerCase();
        const contentType = CONTENT_TYPES[extension] ?? "application/octet-stream";
        res.status(200);
        res.raw.setHeader("content-type", contentType);
        res.raw.setHeader("content-length", stats.size);
        res.raw.setHeader("accept-ranges", "none");
        if (maxAge > 0) {
            res.raw.setHeader("cache-control", `public, max-age=${maxAge}`);
        }
        if (req.method === "HEAD") {
            res.end();
            return;
        }
        const stream = createReadStream(target);
        stream.on("error", () => {
            if (!res.headersSent) res.status(500).json({ status: "error", message: "Failed to read file" });
            else res.end();
        });
        stream.pipe(res.raw);
    };
}

