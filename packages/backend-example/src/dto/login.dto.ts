import { IsEmail, IsString, MinLength } from "@solumjs/validation";

export class LoginRequestDto {
    @IsEmail()
    email!: string;

    @IsString()
    @MinLength(1)
    password!: string;
}
