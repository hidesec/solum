import { Tag } from "@entities/tag.entity";

export class TagResponseDto {
    id: string;
    name: string;

    constructor(tag: Tag) {
        this.id = tag.id;
        this.name = tag.name;
    }

    static fromEntity(tag: Tag): TagResponseDto {
        return new TagResponseDto(tag);
    }
}
