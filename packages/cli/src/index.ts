import fs from "fs";
import path from "path";

interface Template {
    name: string;
    content: string;
}

function toPascalCase(str: string): string {
    return str
        .replace(/[-_\s]+(.)?/g, (_, c) => (c ? c.toUpperCase() : ""))
        .replace(/^(.)/, (_, c) => c.toUpperCase());
}

function toKebabCase(str: string): string {
    return str
        .replace(/([a-z])([A-Z])/g, "$1-$2")
        .replace(/[\s_]+/g, "-")
        .toLowerCase();
}

const templates: Record<string, (name: string) => Template> = {
    controller: (name) => ({
        name: `${toKebabCase(name)}.controller.ts`,
        content: `import { RestController, Get, Post, Put, Delete } from "@solumjs/http";

@RestController("/api/${toKebabCase(name)}")
export class ${toPascalCase(name)}Controller {

    @Get("/")
    async findAll() {
        return { data: [], message: "List ${name}" };
    }

    @Get("/:id")
    async findOne(id: string) {
        return { data: null, message: "Get ${name} by id" };
    }

    @Post("/")
    async create(body: any) {
        return { data: null, message: "Create ${name}" };
    }

    @Put("/:id")
    async update(id: string, body: any) {
        return { data: null, message: "Update ${name}" };
    }

    @Delete("/:id")
    async remove(id: string) {
        return { message: "Delete ${name}" };
    }
}
`,
    }),

    service: (name) => ({
        name: `${toKebabCase(name)}.service.ts`,
        content: `import { Injectable } from "@solumjs/core";

@Injectable()
export class ${toPascalCase(name)}Service {

    async findAll() {
        return [];
    }

    async findOne(id: string) {
        return null;
    }

    async create(data: any) {
        return data;
    }

    async update(id: string, data: any) {
        return data;
    }

    async remove(id: string) {
        return true;
    }
}
`,
    }),

    repository: (name) => ({
        name: `${toKebabCase(name)}.repository.ts`,
        content: `import { Repository, Entity, Column, PrimaryGeneratedColumn } from "@solumjs/orm";

@Entity("${toKebabCase(name)}")
export class ${toPascalCase(name)} {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ type: "text" })
    name!: string;

    @Column({ type: "datetime", default: () => "CURRENT_TIMESTAMP" })
    createdAt!: Date;
}

export class ${toPascalCase(name)}Repository extends Repository<${toPascalCase(name)}> {
    constructor() {
        super(${toPascalCase(name)});
    }
}
`,
    }),

    middleware: (name) => ({
        name: `${toKebabCase(name)}.middleware.ts`,
        content: `import { Middleware } from "@solumjs/http";

export const ${toPascalCase(name)}Middleware: Middleware = async (req, res, next) => {
    // Add your middleware logic here
    console.log("[${toPascalCase(name)}] \${req.method} \${req.path}");
    next();
};
`,
    }),

    guard: (name) => ({
        name: `${toKebabCase(name)}.guard.ts`,
        content: `import { CanActivate, ExecutionContext } from "@solumjs/http";

export class ${toPascalCase(name)}Guard implements CanActivate {
    canActivate(context: ExecutionContext): boolean {
        // Add your guard logic here
        const request = context.switchToHttp().getRequest();
        const authHeader = request.headers.authorization;

        if (!authHeader) {
            throw new Error("Unauthorized");
        }

        return true;
    }
}
`,
    }),

    entity: (name) => ({
        name: `${toKebabCase(name)}.entity.ts`,
        content: `import { Entity, Column, PrimaryGeneratedColumn } from "@solumjs/orm";

@Entity("${toKebabCase(name)}")
export class ${toPascalCase(name)} {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ type: "text" })
    name!: string;

    @Column({ type: "datetime", default: () => "CURRENT_TIMESTAMP" })
    createdAt!: Date;

    @Column({ type: "datetime", default: () => "CURRENT_TIMESTAMP" })
    updatedAt!: Date;
}
`,
    }),

    dto: (name) => ({
        name: `${toKebabCase(name)}.dto.ts`,
        content: `export interface Create${toPascalCase(name)}Dto {
    name: string;
}

export interface Update${toPascalCase(name)}Dto {
    name?: string;
}
`,
    }),
};

function findSourceDir(): string {
    const cwd = process.cwd();
    const srcDir = path.join(cwd, "src");
    if (fs.existsSync(srcDir)) {
        return srcDir;
    }
    return cwd;
}

function generateFile(template: Template, targetDir: string): string {
    const filePath = path.join(targetDir, template.name);

    if (fs.existsSync(filePath)) {
        throw new Error(`File already exists: ${filePath}`);
    }

    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, template.content, "utf8");

    return filePath;
}

export function run(args: string[]): void {
    const [command, type, name] = args;

    if (command === "new" && type && name) {
        if (!templates[type]) {
            console.error(`Unknown type: ${type}`);
            console.error(`Available types: ${Object.keys(templates).join(", ")}`);
            process.exit(1);
        }

        try {
            const template = templates[type](name);
            const targetDir = findSourceDir();
            const filePath = generateFile(template, targetDir);
            console.log(`Created: ${filePath}`);
        } catch (err) {
            console.error(err instanceof Error ? err.message : String(err));
            process.exit(1);
        }
    } else {
        console.log(`
Usage: solum new <type> <name>

Available types:
  controller  - Create a new REST controller
  service     - Create a new service
  repository  - Create a new repository with entity
  middleware  - Create a new middleware
  guard       - Create a new guard
  entity      - Create a new entity
  dto         - Create a new DTO interface

Examples:
  solum new controller user
  solum new service user
  solum new entity user
        `);
    }
}
