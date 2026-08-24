import fs from "fs";
import path from "path";

const EXCLUDED_DIRS = new Set(["database", "lang", "core", "__test__", "__tests__", "migrations"]);
const ALLOWED_EXTENSIONS = new Set([".ts", ".js"]);

export function componentScan(baseDir: string, dirs?: string[]): void {
    const targets = dirs ?? discoverSubdirs(baseDir);

    targets.forEach((dir) => {
        const fullDir = path.join(baseDir, dir);
        if (fs.existsSync(fullDir)) {
            walk(fullDir);
        }
    })
}

function discoverSubdirs(baseDir: string): string[] {
    return fs.readdirSync(baseDir, { withFileTypes: true })
        .filter((entry) => entry.isDirectory() && !EXCLUDED_DIRS.has(entry.name))
        .map((entry) => entry.name);
}

function walk(dir: string): void {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    entries.forEach((entry) => {
        const fullPath = path.join(dir, entry.name);

        if(entry.isDirectory()) {
            walk(fullPath);
            return;
        }

        const ext = path.extname(entry.name);
        if (!ALLOWED_EXTENSIONS.has(ext)) {
            return;
        }

        const isDeclarationOrTest = entry.name.endsWith(".d.ts") || entry.name.includes(".test.");

        if (!isDeclarationOrTest) {
            require(fullPath);
        }
    });
}
