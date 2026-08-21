import { inject } from "@solumjs/core";
import { LoginRequestDto } from "@dto/login.dto";
import { Bean } from "@solumjs/core";
import { UnauthorizedException } from "@solumjs/core";
import { IUserRepository } from "@repositories/user.repository.interface";
import { verifyPassword } from "@solumjs/auth";
import { IAuthService, LoginResponse } from "./auth.service.interface";
import { IJwtService } from "@solumjs/auth";
import { REFRESH_TOKEN_TTL } from "@solumjs/auth";
import { IRefreshTokenStore } from "@solumjs/auth";

@Bean("IAuthService")
export class AuthService implements IAuthService {
    constructor(
        @inject("IUserRepository")
        private readonly userRepository: IUserRepository,
        @inject("IJwtService")
        private readonly jwtService: IJwtService,
        @inject("IRefreshTokenStore")
        private readonly refreshTokenStore: IRefreshTokenStore
    ) {}

    async login(dto: LoginRequestDto): Promise<LoginResponse> {
        const user = await this.userRepository.findByEmail(dto.email);

        if (!user?.passwordHash || !verifyPassword(dto.password, user.passwordHash)) {
            throw new UnauthorizedException("Invalid email or password");
        }

        return this.issueTokens(user.id, user.email, user.role);
    }

    async refresh(refreshToken: string): Promise<LoginResponse> {
        const payload = this.jwtService.verify(refreshToken);

        if (!payload || payload.type !== "refresh" || !payload.jti) {
            throw new UnauthorizedException("Invalid refresh token");
        }

        if (this.refreshTokenStore.isUsed(payload.jti)) {
            throw new UnauthorizedException("Refresh token has already been used");
        }

        const user = await this.userRepository.findById(payload.sub);
        if (!user) {
            throw new UnauthorizedException("User no longer exists");
        }

        this.refreshTokenStore.markUsed(payload.jti, (payload.exp ?? 0) * 1000);

        return this.issueTokens(user.id, user.email, user.role);
    }

    private issueTokens(id: string, email: string, role: string): LoginResponse {
        const claims = { sub: id, email, role };
        return {
            accessToken: this.jwtService.signAccessToken(claims),
            refreshToken: this.jwtService.signRefreshToken(claims),
            tokenType: "Bearer",
            expiresIn: 3600,
        };
    }
}
