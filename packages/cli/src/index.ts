import { runGenerate } from "./generate";
import { scaffoldProject } from "./scaffold";

export function run(args: string[]): void {
    const [command, first, second] = args;

    if (command === "new" && first) {
        scaffoldProject(first);
    } else if (command === "generate" && first && second) {
        runGenerate(first, second);
    } else if (command === "generate" && first) {
        console.error("Missing name. Usage: solum generate <type> <name>");
        process.exit(1);
    } else {
        console.log(`
Usage:
  solum new <project-name>              Scaffold a new SolumJS project
  solum generate <type> <name>          Generate a file in current project

Generate types:
  controller  - REST controller
  service     - Service class
  repository  - Repository with BaseRepository
  entity      - ORM entity
  dto         - DTO interfaces
  middleware  - Middleware function
  guard       - Guard class

Examples:
  solum new my-api
  solum generate controller user
  solum generate service user
  solum generate entity user
        `);
    }
}
