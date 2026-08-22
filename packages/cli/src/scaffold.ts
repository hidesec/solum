import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { toKebabCase } from "./generate";
import { ProjectFile } from "./project-file";
import { getRootFiles } from "./scaffold-root";
import { getSrcFiles } from "./scaffold-src";

function mkdirp(dir: string): void {
    fs.mkdirSync(dir, { recursive: true });
}

function writeFile(base: string, rel: string, content: string): void {
    const full = path.join(base, rel);
    mkdirp(path.dirname(full));
    fs.writeFileSync(full, content, "utf8");
}

export function scaffoldProject(projectName: string): void {
    const targetDir = path.join(process.cwd(), toKebabCase(projectName));

    if (fs.existsSync(targetDir)) {
        console.error(`Directory already exists: ${targetDir}`);
        process.exit(1);
    }

    fs.mkdirSync(targetDir, { recursive: true });
    console.log(`Creating SolumJS project "${toKebabCase(projectName)}"...`);

    const pkg = toKebabCase(projectName);
    const files: ProjectFile[] = [...getRootFiles(pkg), ...getSrcFiles()];

    for (const f of files) {
        writeFile(targetDir, f.path, f.content);
    }

    console.log(`\nProject created at ${targetDir}`);

    console.log("\nInstalling dependencies...");
    try {
        execSync("npm install", { cwd: targetDir, stdio: "inherit" });
        console.log("\nDependencies installed successfully.");
    } catch {
        console.error("\nFailed to install dependencies. Run 'npm install' manually.");
    }

    console.log("\nDirectory structure:");
    console.log(`
  ${pkg}/
  ├── .env.example
  ├── .gitignore
  ├── jest.config.js
  ├── package.json
  ├── prod-paths.js
  ├── tsconfig.json
  └── src/
      ├── app.ts
      ├── advice/
      │   └── global-exception-filter.ts
      ├── config/
      │   ├── env.ts
      │   ├── logger.ts
      │   └── startup-banner.ts
      ├── controllers/
      │   └── health.controller.ts
      ├── database/
      │   ├── entity-scan.ts
      │   ├── generate-migration.ts
      │   ├── migrate.ts
      │   ├── migrations/
      │   └── sync-schema.ts
      ├── dto/
      │   ├── create-user.dto.ts
      │   └── user-response.dto.ts
      ├── entities/
      │   └── user.entity.ts
      ├── repositories/
      │   ├── user.repository.interface.ts
      │   └── user.repository.ts
      └── services/
          ├── user-created.listener.ts
          ├── user.service.interface.ts
          └── user.service.ts`);
    console.log("Next steps:");
    console.log(`  cd ${toKebabCase(projectName)}`);
    console.log("  cp .env.example .env");
    console.log("  npm run dev");
}
