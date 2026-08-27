import { IAuthService } from "@services/auth.service.interface";
import { AutoWired, UnauthorizedException } from "@solumjs/core";
import { Body, Post, ResponseStatus, RestController, SolumjsRequest, SolumjsResponse, Req, Res, Valid } from "@solumjs/http";
import { LoginRequestDto } from "@dto/login.dto";
import { RefreshTokenDto } from "@dto/refresh-token.dto";

const loginAttempts = new Map<string, { count: number; resetAt: number; lockedUntil?: number }>();
const LOGIN_MAX_ATTEMPTS = 5;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_LOCKOUT_MS = 30 * 60 * 1000;

function checkLoginRateLimit(email: string): void {
    const now = Date.now();
    let bucket = loginAttempts.get(email);
    if (!bucket || bucket.resetAt <= now) {
        bucket = { count: 0, resetAt: now + LOGIN_WINDOW_MS };
        loginAttempts.set(email, bucket);
    }

    if (bucket.lockedUntil && bucket.lockedUntil > now) {
        throw new UnauthorizedException("Account locked. Try again later.");
    }

    bucket.count++;
    if (bucket.count > LOGIN_MAX_ATTEMPTS) {
        bucket.lockedUntil = now + LOGIN_LOCKOUT_MS;
        throw new UnauthorizedException("Too many failed attempts. Account locked for 30 minutes.");
    }
}

function recordLoginSuccess(email: string): void {
    loginAttempts.delete(email);
}

@RestController("/auth")
export class AuthController {
    @AutoWired("IAuthService")
    declare private authService: IAuthService;

    @Post("/login")
    @ResponseStatus(200)
    async login(@Valid() @Body() dto: LoginRequestDto, @Req() req: SolumjsRequest, @Res() res: SolumjsResponse) {
        checkLoginRateLimit(dto.email);
        try {
            const result = await this.authService.login(dto);
            recordLoginSuccess(dto.email);
            req.session?.regenerate();
            req.log.info({ email: dto.email }, "Login successful");
            return result;
        } catch (err) {
            req.log.warn({ email: dto.email }, "Login failed");
            throw err;
        }
    }

    @Post("/refresh")
    @ResponseStatus(200)
    async refresh(@Valid() @Body() dto: RefreshTokenDto) {
        return this.authService.refresh(dto.refreshToken);
    }
}
