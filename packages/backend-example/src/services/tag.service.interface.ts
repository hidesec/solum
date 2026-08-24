import { CreateTagDto } from "@dto/create-tag.dto";
import { Tag } from "@entities/tag.entity";

export interface ITagService {
    createTag(dto: CreateTagDto): Promise<Tag>;
    getTagById(id: string): Promise<Tag>;
    getAllTags(): Promise<Tag[]>;
    deleteTag(id: string): Promise<void>;
}
