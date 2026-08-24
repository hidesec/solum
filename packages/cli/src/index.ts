import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { runGenerate } from "./generate";
import { scaffoldProject } from "./scaffold";

function getVersion(): string {
    try {
        const pkgPath = path.join(__dirname, "..", "package.json");
        const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
        return pkg.version;
    } catch {
        return "unknown";
    }
}

function runTest(extraArgs: string[]): void {
    const packageJsonPath = path.join(process.cwd(), "package.json");
    if (!fs.existsSync(packageJsonPath)) {
        console.error("Error: No package.json found in current directory.");
        console.error("Run this command from your SolumJS project root.");
        process.exit(1);
    }

    try {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
        const hasTestScript = packageJson.scripts?.test;
        if (!hasTestScript) {
            console.error("Error: No 'test' script found in package.json.");
            console.error('Add a test script, e.g.: "test": "jest"');
            process.exit(1);
        }
        execSync(`npm test ${extraArgs.join(" ")}`, { stdio: "inherit", cwd: process.cwd() });
    } catch {
        process.exit(1);
    }
}

function runDbMigrate(extraArgs: string[]): void {
    const packageJsonPath = path.join(process.cwd(), "package.json");
    if (!fs.existsSync(packageJsonPath)) {
        console.error("Error: No package.json found in current directory.");
        console.error("Run this command from your SolumJS project root.");
        process.exit(1);
    }

    try {
        require("dotenv/config");
    } catch {
        // dotenv is optional
    }

    console.log("Running database migrations...");

    const migrateScript = path.join(process.cwd(), "node_modules", "@solumjs", "cli", "dist", "migrate.js");
    if (fs.existsSync(migrateScript)) {
        try {
            execSync(`node "${migrateScript}" ${extraArgs.join(" ")}`, { stdio: "inherit", cwd: process.cwd() });
            return;
        } catch {
            process.exit(1);
        }
    }

    try {
        execSync(
            `node -e "const {createApplication}=require('@solumjs/config');const {runMigrations}=require('@solumjs/database');const app=createApplication();runMigrations().then(()=>process.exit(0)).catch(e=>{console.error(e);process.exit(1)})" ${extraArgs.join(" ")}`,
            { stdio: "inherit", cwd: process.cwd() }
        );
    } catch {
        console.error("Migration failed. Ensure database is configured in .env");
        process.exit(1);
    }
}

export function run(args: string[]): void {
    const [command, first, second, ...rest] = args;

    if (command === "-v" || command === "--version" || command === "version") {
        console.log(`solum v${getVersion()}`);
    } else if (command === "new" && first) {
        scaffoldProject(first);
    } else if (command === "generate" && first && second) {
        runGenerate(first, second);
    } else if (command === "generate" && first) {
        console.error("Missing name. Usage: solum generate <type> <name>");
        process.exit(1);
    } else if (command === "test") {
        runTest(rest);
    } else if (command === "db:migrate" || command === "db:migration") {
        runDbMigrate(rest);
    } else {
        console.log(`
solum v${getVersion()} - SolumJS CLI

Usage:
  solum new <project-name>              Scaffold a new SolumJS project
  solum generate <type> <name>          Generate a file in current project
  solum test                            Run tests for current project
  solum db:migrate                      Run database migrations
  solum --version, -v                   Show version

Generate types:
  controller  - REST controller
  service     - Service class
  repository  - Repository with BaseRepository
  entity      - ORM entity
  dto         - DTO interfaces
  middleware  - Middleware function
  guard       - Guard class
  listener    - Event listener
  filter      - Exception filter

Examples:
  solum new my-api
  solum generate controller user
  solum test
  solum db:migrate
        `);
    }
}
