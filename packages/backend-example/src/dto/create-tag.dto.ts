import { IsString, MinLength } from "@solumjs/validation";

export class CreateTagDto {
    @IsString()
    @MinLength(1)
    name!: string;
}
