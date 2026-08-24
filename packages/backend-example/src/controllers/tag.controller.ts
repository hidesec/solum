import { JwtAuthGuard, PreAuthorize } from "@solumjs/auth";
import { SolumjsRequest } from "@solumjs/http";
import { TagResponseDto } from "@dto/tag-response.dto";
import { CreateTagDto } from "@dto/create-tag.dto";
import { ITagService } from "@services/tag.service.interface";
import { AutoWired } from "@solumjs/core";
import { Body, Delete, Get, Param, Post, Req, ResponseStatus, RestController, UseGuards, Valid } from "@solumjs/http";
import { ExceptionHandler } from "@solumjs/middlewares";
import { ConflictException } from "@solumjs/core";

@RestController("/tags")
export class TagController {
    @AutoWired("ITagService")
    declare private tagService: ITagService;

    @Post("/")
    @ResponseStatus(201)
    @UseGuards(JwtAuthGuard)
    @PreAuthorize("hasRole('ADMIN')")
    async createTag(@Valid({ whitelist: true }) @Body() dto: CreateTagDto, @Req() req: SolumjsRequest) {
        req.log.info({ body: { name: dto.name } }, "Creating new tag");
        const tag = await this.tagService.createTag(dto);
        req.log.info({ tagId: tag.id }, "Tag created successfully");
        return TagResponseDto.fromEntity(tag);
    }

    @Get("/")
    @ResponseStatus(200)
    async listTags(@Req() req: SolumjsRequest) {
        req.log.info({}, "Listing all tags");
        const tags = await this.tagService.getAllTags();
        return { content: tags.map(TagResponseDto.fromEntity) };
    }

    @Get("/:id")
    @ResponseStatus(200)
    async getTagById(@Param("id") id: string, @Req() req: SolumjsRequest) {
        req.log.info({ param: id }, "Get tag by id");
        const tag = await this.tagService.getTagById(id);
        req.log.info({ param: id }, "Get tag successfully");
        return TagResponseDto.fromEntity(tag);
    }

    @Delete("/:id")
    @ResponseStatus(200)
    @UseGuards(JwtAuthGuard)
    @PreAuthorize("hasRole('ADMIN')")
    async deleteTag(@Param("id") id: string, @Req() req: SolumjsRequest) {
        req.log.info({ param: id }, "Deleting tag");
        await this.tagService.deleteTag(id);
        return { status: "success", message: `Tag ${id} deleted` };
    }

    @ExceptionHandler(ConflictException)
    handleDuplicateName(err: ConflictException, req: SolumjsRequest) {
        req.log.warn({ path: req.path }, err.message);
        return { status: "error", code: "TAG_NAME_CONFLICT", message: err.message };
    }
}
