import { IsJWT } from "@solumjs/validation";

export class RefreshTokenDto {
    @IsJWT()
    refreshToken!: string;
}
