import { ITagRepository } from "@repositories/tag.repository.interface";
import { ITagService } from "./tag.service.interface";
import { CreateTagDto } from "@dto/create-tag.dto";
import { Tag } from "@entities/tag.entity";
import { ConflictException, NotFoundException, inject } from "@solumjs/core";
import { Bean } from "@solumjs/core";
import { randomUUID } from "crypto";
import { Transactional } from "@solumjs/database";
import { Auditable, LogExecution } from "@solumjs/aop";
import { CacheEvict, Cacheable } from "@solumjs/cache";
import { logger } from "@config/logger";

@Bean("ITagService")
export class TagService implements ITagService {
    constructor(
        @inject("ITagRepository")
        private readonly tagRepository: ITagRepository
    ) {}

    @Transactional()
    @Auditable("TAG_CREATED")
    @LogExecution()
    async createTag(dto: CreateTagDto): Promise<Tag> {
        const id = randomUUID();
        const existing = await this.tagRepository.findByName(dto.name);
        if (existing) {
            throw new ConflictException(`Tag "${dto.name}" already exists`);
        }

        const tag = new Tag();
        tag.id = id;
        tag.name = dto.name;

        const saved = await this.tagRepository.save(tag);
        logger.info({ tagId: saved.id, name: saved.name }, "Tag created");
        return saved;
    }

    @Auditable("GET_TAG")
    @LogExecution()
    @Cacheable("tags", 120)
    async getTagById(id: string): Promise<Tag> {
        const tag = await this.tagRepository.findById(id);
        if (!tag) {
            throw new NotFoundException(`Tag with id ${id} not found`);
        }
        return tag;
    }

    @LogExecution()
    @Cacheable("tags", 120)
    async getAllTags(): Promise<Tag[]> {
        return this.tagRepository.findAll();
    }

    @Transactional()
    @Auditable("TAG_DELETED")
    @LogExecution()
    @CacheEvict("tags")
    async deleteTag(id: string): Promise<void> {
        const tag = await this.tagRepository.findById(id);
        if (!tag) {
            throw new NotFoundException(`Tag with id ${id} not found`);
        }
        await this.tagRepository.deleteById(id);
    }
}
