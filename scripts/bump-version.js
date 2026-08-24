const fs = require("fs");
const path = require("path");

const packagesDir = path.join(__dirname, "..", "packages");

const publishablePackages = [
    "core", "http", "aop", "orm", "database", "cache", "auth",
    "events", "schedule", "validation", "middlewares", "config",
    "testing", "websocket", "email",
];

const allPackages = fs.readdirSync(packagesDir).filter((p) => {
    const pkgPath = path.join(packagesDir, p, "package.json");
    return fs.existsSync(pkgPath);
});

// Parse CLI args: node scripts/bump-version.js <major|minor|patch> [--dry-run]
const bumpType = process.argv[2] || "patch";
const dryRun = process.argv.includes("--dry-run");

if (!["major", "minor", "patch"].includes(bumpType)) {
    console.error("Usage: node scripts/bump-version.js <major|minor|patch> [--dry-run]");
    process.exit(1);
}

function bumpVersion(version, type) {
    const [major, minor, patch] = version.split(".").map(Number);
    switch (type) {
        case "major": return `${major + 1}.0.0`;
        case "minor": return `${major}.${minor + 1}.0`;
        case "patch": return `${major}.${minor}.${patch + 1}`;
    }
}

function bumpMinor(version) {
    const [major, minor, patch] = version.split(".").map(Number);
    return `${major}.${minor + 1}.0`;
}

console.log(`\n📦 Bumping versions (${bumpType})${dryRun ? " [DRY RUN]" : ""}\n`);

for (const pkg of allPackages) {
    const pkgPath = path.join(packagesDir, pkg, "package.json");
    const pkgJson = JSON.parse(fs.readFileSync(pkgPath, "utf8"));

    if (pkgJson.private) continue;

    const newVersion = bumpVersion(pkgJson.version, bumpType);
    console.log(`  ${pkgJson.name}: ${pkgJson.version} → ${newVersion}`);

    if (!dryRun) {
        pkgJson.version = newVersion;

        const depFields = ["dependencies", "peerDependencies"];
        for (const field of depFields) {
            if (pkgJson[field]) {
                for (const [dep, ver] of Object.entries(pkgJson[field])) {
                    if (dep.startsWith("@solumjs/") && ver.startsWith("^")) {
                        pkgJson[field][dep] = `^${newVersion}`;
                    }
                }
            }
        }

        fs.writeFileSync(pkgPath, JSON.stringify(pkgJson, null, 2) + "\n");
    }
}

// Handle solumjs meta package (separate version scheme)
const metaPath = path.join(packagesDir, "solumjs", "package.json");
if (fs.existsSync(metaPath)) {
    const meta = JSON.parse(fs.readFileSync(metaPath, "utf8"));
    const newVersion = bumpVersion(meta.version, bumpType);
    console.log(`  ${meta.name}: ${meta.version} → ${newVersion}`);

    if (!dryRun) {
        meta.version = newVersion;
        if (meta.dependencies) {
            for (const [dep, ver] of Object.entries(meta.dependencies)) {
                if (dep.startsWith("@solumjs/") && ver.startsWith("^")) {
                    // Read actual version from the package's own package.json
                    const pkgName = dep.replace("@solumjs/", "");
                    const depPkgPath = path.join(packagesDir, pkgName, "package.json");
                    if (fs.existsSync(depPkgPath)) {
                        const depPkg = JSON.parse(fs.readFileSync(depPkgPath, "utf8"));
                        meta.dependencies[dep] = `^${depPkg.version}`;
                    }
                }
            }
        }
        fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2) + "\n");
    }
}

// Handle CLI (separate version scheme)
const cliPath = path.join(packagesDir, "cli", "package.json");
if (fs.existsSync(cliPath)) {
    const cli = JSON.parse(fs.readFileSync(cliPath, "utf8"));
    const newVersion = bumpVersion(cli.version, bumpType);
    console.log(`  ${cli.name}: ${cli.version} → ${newVersion}`);

    if (!dryRun) {
        cli.version = newVersion;
        fs.writeFileSync(cliPath, JSON.stringify(cli, null, 2) + "\n");
    }
}

console.log(`\n${dryRun ? "(dry run — no files changed)" : "Done! Run 'npm run build && npm test --workspaces --if-present' to verify."}`);
