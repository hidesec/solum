import { LoginRequestDto } from "@dto/login.dto";

export interface LoginResponse {
    accessToken: string;
    refreshToken: string;
    tokenType: "Bearer";
    expiresIn: number;
}

export interface IAuthService {
    login(dto: LoginRequestDto): Promise<LoginResponse>;
    refresh(refreshToken: string): Promise<LoginResponse>;
}
