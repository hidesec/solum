import fs from "fs";
import path from "path";

export function scanEntities(entitiesDir: string): void {
  if (!fs.existsSync(entitiesDir)) return;

  fs.readdirSync(entitiesDir)
    .filter((f) => /\.(ts|js)$/.test(f) && !f.endsWith(".d.ts"))
    .forEach((f) => {
      require(path.join(entitiesDir, f));
    });
}