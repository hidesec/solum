import fs from "fs";
import path from "path";
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

export function run(args: string[]): void {
    const [command, first, second] = args;

    if (command === "-v" || command === "--version" || command === "version") {
        console.log(`solum v${getVersion()}`);
    } else if (command === "new" && first) {
        scaffoldProject(first);
    } else if (command === "generate" && first && second) {
        runGenerate(first, second);
    } else if (command === "generate" && first) {
        console.error("Missing name. Usage: solum generate <type> <name>");
        process.exit(1);
    } else {
        console.log(`
solum v${getVersion()} - SolumJS CLI

Usage:
  solum new <project-name>              Scaffold a new SolumJS project
  solum generate <type> <name>          Generate a file in current project
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
  solum generate service user
  solum generate entity user
        `);
    }
}
