import { inject, getFrameworkLogger } from "@solumjs/core";
import { LoginRequestDto } from "@dto/login.dto";
import { Bean } from "@solumjs/core";
import { UnauthorizedException } from "@solumjs/core";
import { IUserRepository } from "@repositories/user.repository.interface";
import { verifyPassword } from "@solumjs/auth";
import { IAuthService, LoginResponse } from "./auth.service.interface";
import { IJwtService } from "@solumjs/auth";
import { REFRESH_TOKEN_TTL } from "@solumjs/auth";
import { IRefreshTokenStore } from "@solumjs/auth";

const logger = getFrameworkLogger();

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
        const normalizedEmail = dto.email.toLowerCase().trim();
        const user = await this.userRepository.findByEmail(normalizedEmail);

        const dummyHash = "$2b$10$000000000000000000000000000000000000000000000000000000";
        const hash = user?.passwordHash ?? dummyHash;
        const valid = verifyPassword(dto.password, hash);

        if (!user?.passwordHash || !valid) {
            logger.warn({ email: normalizedEmail }, "Failed login attempt");
            throw new UnauthorizedException("Invalid email or password");
        }

        return this.issueTokens(user.id, user.email, user.role);
    }

    async refresh(refreshToken: string): Promise<LoginResponse> {
        const payload = this.jwtService.verify(refreshToken);

        if (!payload || payload.type !== "refresh" || !payload.jti) {
            throw new UnauthorizedException("Invalid refresh token");
        }

        if (!this.refreshTokenStore.markUsedIfAbsent(payload.jti, (payload.exp ?? 0) * 1000)) {
            throw new UnauthorizedException("Refresh token has already been used");
        }

        const user = await this.userRepository.findById(payload.sub);
        if (!user) {
            throw new UnauthorizedException("User no longer exists");
        }

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
