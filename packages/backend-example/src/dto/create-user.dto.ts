import { IsEmail, IsOptional, IsString, MinLength } from "@solumjs/validation";

export class CreateUserDto {
    @IsString()
    @MinLength(3)
    name!: string;

    @IsEmail()
    email!: string;

    @IsOptional()
    @IsString()
    @MinLength(8)
    password?: string;
}
