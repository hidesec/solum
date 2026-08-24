import { IsString, MinLength, IsNumber, Min, IsOptional, IsArray } from "@solumjs/validation";

export class CreateProductDto {
    @IsString()
    @MinLength(1)
    name!: string;

    @IsNumber()
    @Min(0)
    price!: number;

    @IsOptional()
    @IsArray()
    tagIds?: string[];
}
