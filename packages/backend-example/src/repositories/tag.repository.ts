import { Bean } from "@solumjs/core";
import { BaseRepository } from "@solumjs/database";
import { ITagRepository } from "./tag.repository.interface";
import { Tag } from "@entities/tag.entity";

@Bean("ITagRepository")
export class TagRepository extends BaseRepository<Tag, string> implements ITagRepository {
    protected readonly entityCtor = Tag;

    async findByName(name: string): Promise<Tag | null> {
        return this.query().where("name", name).first();
    }

    async findByIds(ids: string[]): Promise<Tag[]> {
        return this.query().whereIn("id", ids).get();
    }
}
