import { Bean } from "@solumjs/core";
import { CanActivate, ExecutionContext, getRequiredRoles } from "@solumjs/http";
import { ForbiddenException, UnauthorizedException } from "@solumjs/core";
import { getPrincipal, AuthenticatedRequest } from "./jwt-auth.guard";

@Bean()
export class RolesGuard implements CanActivate {
    canActivate(context: ExecutionContext): boolean {
        const required = getRequiredRoles(context.classRef, context.handlerName);
        if (required.length === 0) return true;

        const principal = getPrincipal(context.request);
        if (!principal) {
            throw new UnauthorizedException("Authentication required before role check");
        }

        if (!required.includes(principal.role)) {
            throw new ForbiddenException(`Requires one of roles: ${required.join(", ")}`);
        }

        return true;
    }
}
