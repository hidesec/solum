import { IAuthService } from "@services/auth.service.interface";
import { AutoWired } from "@solumjs/decorators";
import { Post, RestController } from "@solumjs/decorators";
import { ResponseStatus } from "@solumjs/decorators";
import { Body, Valid } from "@solumjs/decorators";
import { LoginRequestDto } from "@dto/login.dto";
import { RefreshTokenDto } from "@dto/refresh-token.dto";

@RestController("/auth")
export class AuthController {
    @AutoWired("IAuthService")
    declare private authService: IAuthService;

    @Post("/login")
    @ResponseStatus(200)
    async login(@Valid() @Body() dto: LoginRequestDto) {
        return this.authService.login(dto);
    }

    @Post("/refresh")
    @ResponseStatus(200)
    async refresh(@Valid() @Body() dto: RefreshTokenDto) {
        return this.authService.refresh(dto.refreshToken);
    }
}
