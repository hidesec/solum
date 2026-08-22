import { Bean, ForbiddenException } from "@solumjs/core";
import { CanActivate, ExecutionContext } from "@solumjs/http";
import { getPrincipal } from "./guards/jwt-auth.guard";
import { evaluateExpression, getPreAuthorizeExpression } from "./expression-evaluator";

@Bean()
export class ExpressionGuard implements CanActivate {
    canActivate(context: ExecutionContext): boolean {
        const expression = getPreAuthorizeExpression(context.classRef, context.handlerName);
        if (!expression) return true;

        const principal = getPrincipal(context.request);

        try {
            const allowed = evaluateExpression(expression, principal);
            if (!allowed) {
                throw new ForbiddenException(
                    `Access denied by @PreAuthorize("${expression}")`
                );
            }
            return true;
        } catch (err) {
            if (err instanceof ForbiddenException) throw err;
            throw new ForbiddenException(
                `Failed to evaluate security expression: "${expression}"`
            );
        }
    }
}
