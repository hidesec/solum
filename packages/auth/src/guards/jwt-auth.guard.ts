import { JwtPayload } from "../jwt.service.interface";
import { AutoWired, Bean } from "@solumjs/core";
import { CanActivate, ExecutionContext } from "@solumjs/http";
import { UnauthorizedException } from "@solumjs/core";
import { SolumjsRequest } from "@solumjs/http";
import { IJwtService } from "../jwt.service.interface";

export interface AuthenticatedRequest extends SolumjsRequest {
    user?: JwtPayload;
}

export function getPrincipal(request: SolumjsRequest): JwtPayload | undefined {
    return (request as AuthenticatedRequest).user;
}

@Bean()
export class JwtAuthGuard implements CanActivate {
    @AutoWired("IJwtService")
    declare private jwtService: IJwtService;

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const header = context.request.headers["authorization"];

        if (!header || typeof header !== "string" || !header.startsWith("Bearer ")) {
            throw new UnauthorizedException("Missing bearer token");
        }

        const payload = this.jwtService.verify(header.slice("Bearer ".length));
        if (!payload) {
            throw new UnauthorizedException("Invalid or expired token");
        }

        if (payload.type !== "access") {
            throw new UnauthorizedException("Access token required");
        }

        (context.request as AuthenticatedRequest).user = payload;
        return true;
    }
}
