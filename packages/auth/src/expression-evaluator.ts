import { JwtPayload } from "./jwt.service.interface";

type ExprFunction = (principal: JwtPayload | undefined, args: string[]) => boolean;

const BUILT_IN_FUNCTIONS: Record<string, ExprFunction> = {
    hasRole: (principal, args) => {
        if (!principal || args.length === 0) return false;
        return principal.role === args[0];
    },
    hasAnyRole: (principal, args) => {
        if (!principal || args.length === 0) return false;
        return args.includes(principal.role);
    },
    isAuthenticated: (principal) => {
        return principal !== undefined && principal !== null;
    },
};

const FUNCTION_CALL_RE = /^(\w+)\(([^)]*)\)$/;
const STRING_ARG_RE = /^['"]([^'"]*)['"]$/;

function parseArguments(argsStr: string): string[] {
    const trimmed = argsStr.trim();
    if (trimmed.length === 0) return [];

    return trimmed.split(",").map((arg) => {
        const match = STRING_ARG_RE.exec(arg.trim());
        return match ? match[1] : arg.trim();
    });
}

export function evaluateExpression(expression: string, principal: JwtPayload | undefined): boolean {
    let expr = expression.trim();

    let negate = false;
    if (expr.startsWith("!")) {
        negate = true;
        expr = expr.slice(1).trim();
    }

    const match = FUNCTION_CALL_RE.exec(expr);
    if (!match) {
        throw new Error(
            `Invalid security expression: "${expression}". ` +
            `Expected function call like hasRole('ADMIN'), hasAnyRole('A','B'), or isAuthenticated().`
        );
    }

    const [, funcName, argsStr] = match;
    const args = parseArguments(argsStr);

    const func = BUILT_IN_FUNCTIONS[funcName];
    if (!func) {
        const available = Object.keys(BUILT_IN_FUNCTIONS).join(", ");
        throw new Error(
            `Unknown security function: "${funcName}". Available functions: ${available}`
        );
    }

    const result = func(principal, args);
    return negate ? !result : result;
}

export function getPreAuthorizeExpression(target: Function, handlerName: string): string | undefined {
    const methodLevel: string | undefined =
        Reflect.getMetadata("custom:pre-authorize", target, handlerName);
    if (methodLevel) return methodLevel;

    const classLevel: string | undefined =
        Reflect.getMetadata("custom:pre-authorize", target);
    return classLevel;
}
