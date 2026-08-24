const fs = require("fs");
const path = require("path");

const packagesDir = path.join(__dirname, "..", "packages");
const packages = fs.readdirSync(packagesDir).filter((p) => {
    const pkgJson = path.join(packagesDir, p, "package.json");
    return fs.existsSync(pkgJson);
});

console.log("\n📊 SolumJS Package Size Report");
console.log("═".repeat(60));

let totalJs = 0;
let totalDts = 0;
const results = [];

for (const pkg of packages) {
    const distDir = path.join(packagesDir, pkg, "dist");
    if (!fs.existsSync(distDir)) continue;

    let jsSize = 0;
    let dtsSize = 0;
    let fileCount = 0;

    function walkDir(dir) {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                walkDir(fullPath);
            } else if (entry.name.endsWith(".js")) {
                jsSize += fs.statSync(fullPath).size;
                fileCount++;
            } else if (entry.name.endsWith(".d.ts")) {
                dtsSize += fs.statSync(fullPath).size;
            }
        }
    }

    walkDir(distDir);
    totalJs += jsSize;
    totalDts += dtsSize;
    results.push({ name: `@solumjs/${pkg}`, jsSize, dtsSize, fileCount });
}

results.sort((a, b) => b.jsSize - a.jsSize);

for (const r of results) {
    const jsKb = (r.jsSize / 1024).toFixed(1);
    const dtsKb = (r.dtsSize / 1024).toFixed(1);
    const bar = "█".repeat(Math.min(Math.round(r.jsSize / 1024), 40));
    console.log(`  ${r.name.padEnd(25)} ${jsKb.padStart(7)} kB JS  ${dtsKb.padStart(5)} kB DTS  ${bar}`);
}

console.log("─".repeat(60));
console.log(`  ${"TOTAL".padEnd(25)} ${(totalJs / 1024).toFixed(1).padStart(7)} kB JS  ${(totalDts / 1024).toFixed(1).padStart(5)} kB DTS`);
console.log(`  Packages: ${results.length}`);
console.log("");
