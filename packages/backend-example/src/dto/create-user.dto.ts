import { IsEmail, IsOptional, IsString, MinLength, Pattern } from "@solumjs/validation";

export class CreateUserDto {
    @IsString()
    @MinLength(3)
    name!: string;

    @IsEmail()
    email!: string;

    @IsOptional()
    @IsString()
    @MinLength(8)
    @Pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*])/)
    password?: string;
}
