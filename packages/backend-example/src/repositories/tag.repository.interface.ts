import { Tag } from "@entities/tag.entity";
import { IBaseRepository } from "@solumjs/database";

export interface ITagRepository extends IBaseRepository<Tag, string> {
    findByName(name: string): Promise<Tag | null>;
    findByIds(ids: string[]): Promise<Tag[]>;
}
