import fs from "fs";
import path from "path";

interface Template {
    name: string;
    content: string;
}

interface TypedTemplate extends Template {
    dir: string;
}

export function toPascalCase(str: string): string {
    return str
        .replace(/[-_\s]+(.)?/g, (_, c: string) => (c ? c.toUpperCase() : ""))
        .replace(/^(.)/, (_: string, c: string) => c.toUpperCase());
}

export function toKebabCase(str: string): string {
    return str
        .replace(/([a-z])([A-Z])/g, "$1-$2")
        .replace(/[\s_]+/g, "-")
        .toLowerCase();
}

function buildTemplate(dir: string, fileName: string, lines: string[]): TypedTemplate {
    return { dir, name: fileName, content: lines.join("\n") };
}

export const generateTemplates: Record<string, (name: string) => TypedTemplate> = {
    controller: (name) => buildTemplate("controllers", `${toKebabCase(name)}.controller.ts`, [
        `import { RestController, Get, Post, Put, Delete, Param, Body } from "@solumjs/http";`,
        ``,
        `@RestController("/api/${toKebabCase(name)}")`,
        `export class ${toPascalCase(name)}Controller {`,
        ``,
        `    @Get("/")`,
        `    async findAll() {`,
        `        return { data: [], message: "List ${name}" };`,
        `    }`,
        ``,
        `    @Get("/:id")`,
        `    async findOne(@Param("id") id: string) {`,
        `        return { data: null, message: "Get ${name} by id" };`,
        `    }`,
        ``,
        `    @Post("/")`,
        `    async create(@Body() body: any) {`,
        `        return { data: null, message: "Create ${name}" };`,
        `    }`,
        ``,
        `    @Put("/:id")`,
        `    async update(@Param("id") id: string, @Body() body: any) {`,
        `        return { data: null, message: "Update ${name}" };`,
        `    }`,
        ``,
        `    @Delete("/:id")`,
        `    async remove(@Param("id") id: string) {`,
        `        return { message: "Delete ${name}" };`,
        `    }`,
        `}`,
    ]),

    service: (name) => buildTemplate("services", `${toKebabCase(name)}.service.ts`, [
        `import { Injectable } from "@solumjs/core";`,
        ``,
        `@Injectable()`,
        `export class ${toPascalCase(name)}Service {`,
        ``,
        `    async findAll() { return []; }`,
        `    async findOne(id: string) { return null; }`,
        `    async create(data: any) { return data; }`,
        `    async update(id: string, data: any) { return data; }`,
        `    async remove(id: string) { return true; }`,
        `}`,
    ]),

    repository: (name) => buildTemplate("repositories", `${toKebabCase(name)}.repository.ts`, [
        `import { Bean } from "@solumjs/core";`,
        `import { BaseRepository } from "@solumjs/database";`,
        `import { ${toPascalCase(name)} } from "@entities/${toKebabCase(name)}.entity";`,
        ``,
        `@Bean("I${toPascalCase(name)}Repository")`,
        `export class ${toPascalCase(name)}Repository extends BaseRepository<${toPascalCase(name)}, string> {`,
        `    protected readonly entityCtor = ${toPascalCase(name)};`,
        `}`,
    ]),

    entity: (name) => buildTemplate("entities", `${toKebabCase(name)}.entity.ts`, [
        `import { Entity, Column, ColumnType, PrimaryGeneratedColumn, CreatedAtColumn } from "@solumjs/orm";`,
        ``,
        `@Entity("${toKebabCase(name)}s")`,
        `export class ${toPascalCase(name)} {`,
        `    @PrimaryGeneratedColumn(ColumnType.UUID)`,
        `    public readonly id!: string;`,
        ``,
        `    @Column({ type: ColumnType.VARCHAR, length: 255 })`,
        `    public name!: string;`,
        ``,
        `    @CreatedAtColumn()`,
        `    public readonly createdAt!: Date;`,
        ``,
        `    constructor(id: string, name: string, createdAt: Date = new Date()) {`,
        `        this.id = id;`,
        `        this.name = name;`,
        `        this.createdAt = createdAt;`,
        `    }`,
        `}`,
    ]),

    dto: (name) => buildTemplate("dto", `${toKebabCase(name)}.dto.ts`, [
        `export interface Create${toPascalCase(name)}Dto {`,
        `    name: string;`,
        `}`,
        ``,
        `export interface Update${toPascalCase(name)}Dto {`,
        `    name?: string;`,
        `}`,
    ]),

    middleware: (name) => buildTemplate("middlewares", `${toKebabCase(name)}.middleware.ts`, [
        `import { Middleware } from "@solumjs/http";`,
        ``,
        `export const ${toPascalCase(name)}Middleware: Middleware = async (req, res, next) => {`,
        `    console.log("[${toPascalCase(name)}] \${req.method} \${req.path}");`,
        `    next();`,
        `};`,
    ]),

    guard: (name) => buildTemplate("guards", `${toKebabCase(name)}.guard.ts`, [
        `import { CanActivate, ExecutionContext } from "@solumjs/http";`,
        ``,
        `export class ${toPascalCase(name)}Guard implements CanActivate {`,
        `    canActivate(context: ExecutionContext): boolean {`,
        `        const request = context.switchToHttp().getRequest();`,
        `        const authHeader = request.headers.authorization;`,
        `        if (!authHeader) throw new Error("Unauthorized");`,
        `        return true;`,
        `    }`,
        `}`,
    ]),

    listener: (name) => buildTemplate("services", `${toKebabCase(name)}.listener.ts`, [
        `import { OnEvent } from "@solumjs/events";`,
        `import { logger } from "@config/logger";`,
        ``,
        `export class ${toPascalCase(name)}Listener {`,
        `    @OnEvent("${toKebabCase(name).toUpperCase()}")`,
        `    handle(payload: any) {`,
        `        logger.info({ payload }, "${toPascalCase(name)} event received");`,
        `    }`,
        `}`,
    ]),

    filter: (name) => buildTemplate("advice", `${toKebabCase(name)}.filter.ts`, [
        `import { ExceptionHandler } from "@solumjs/middlewares";`,
        `import { SolumjsRequest } from "@solumjs/http";`,
        ``,
        `export class ${toPascalCase(name)}Filter {`,
        `    @ExceptionHandler(Error)`,
        `    handle(err: Error, req: SolumjsRequest) {`,
        `        req.log.error({ path: req.path, err }, "${toPascalCase(name)} error");`,
        `        return { status: "error", message: err.message };`,
        `    }`,
        `}`,
    ]),
};

function findSourceDir(): string {
    const cwd = process.cwd();
    const srcDir = path.join(cwd, "src");
    if (fs.existsSync(srcDir)) {
        return srcDir;
    }
    return cwd;
}

function generateFile(template: TypedTemplate, baseDir: string): string {
    const filePath = path.join(baseDir, template.dir, template.name);
    if (fs.existsSync(filePath)) {
        throw new Error(`File already exists: ${filePath}`);
    }
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, template.content, "utf8");
    return filePath;
}

export function runGenerate(type: string, name: string): void {
    if (!generateTemplates[type]) {
        console.error(`Unknown type: ${type}`);
        console.error(`Available types: ${Object.keys(generateTemplates).join(", ")}`);
        process.exit(1);
    }
    const template = generateTemplates[type](name);
    const baseDir = findSourceDir();
    const filePath = generateFile(template, baseDir);
    console.log(`Created: ${filePath}`);
}
