export interface ParsedPointcut {
    raw: string;
    returnType: string;
    classPattern: string;
    methodPattern: string;
    argsPattern: string;
}

const NAMED_POINTCUTS = new Map<string, string>();

export function Pointcut(name: string, expression: string): MethodDecorator {
    return function (target: object, _propertyKey: string | symbol) {
        parsePointcut(expression);
        NAMED_POINTCUTS.set(name, expression);
        Reflect.defineMetadata("custom:pointcut-named", expression, target.constructor ?? target, name);
    };
}

export function resolvePointcut(nameOrExpression: string): string {
    if (NAMED_POINTCUTS.has(nameOrExpression)) {
        return NAMED_POINTCUTS.get(nameOrExpression)!;
    }
    return nameOrExpression;
}

export function getNamedPointcut(name: string): string | undefined {
    return NAMED_POINTCUTS.get(name);
}

export function parsePointcut(expression: string): ParsedPointcut {
    const resolved = resolvePointcut(expression);
    const trimmed = resolved.trim();
    if (trimmed.length === 0) {
        throw new Error("Pointcut expression must not be empty.");
    }

    let body = trimmed;
    if (body.startsWith("execution")) {
        const open = body.indexOf("(");
        if (open === -1 || !body.endsWith(")")) {
            throw new Error(`Malformed execution pointcut: "${expression}"`);
        }
        body = body.slice(open + 1, -1).trim();
    }

    const openParen = body.lastIndexOf("(");
    if (openParen === -1 || !body.endsWith(")")) {
        throw new Error(
            `Invalid pointcut "${expression}". Expected "execution(<ret> <ClassPattern>.<methodPattern>(<args>))" or shorthand "<ret> <ClassPattern>.<methodPattern>(<args>)".`
        );
    }

    const argsPattern = body.slice(openParen + 1, -1).trim();
    const head = body.slice(0, openParen).trim();
    const tokens = head.split(/\s+/);

    const returnType = tokens.length >= 2 ? tokens[tokens.length - 2] : "*";
    const signature = tokens[tokens.length - 1];

    const dotIndex = signature.lastIndexOf(".");
    if (dotIndex <= 0 || dotIndex === signature.length - 1) {
        throw new Error(
            `Invalid pointcut "${expression}": signature must look like ClassPattern.methodPattern.`
        );
    }

    let classPattern = signature.slice(0, dotIndex);
    const methodPattern = signature.slice(dotIndex + 1);

    if (dotIndex >= 2 && signature[dotIndex - 1] === ".") {
        const base = signature.slice(0, dotIndex - 1);
        classPattern = base.length > 0 ? `${base}.**` : "**";
    }

    return {
        raw: expression,
        returnType,
        classPattern,
        methodPattern,
        argsPattern,
    };
}

export function matchesArgs(pattern: string, argCount: number): boolean {
    if (pattern === "..") return true;
    if (pattern === "") return argCount === 0;
    if (pattern === "*") return argCount === 1;
    return pattern.split(",").length === argCount;
}

function escapeRegex(ch: string): string {
    return "\\^$.|?+()[]{}".includes(ch) ? `\\${ch}` : ch;
}

function segmentToRegex(segment: string): string {
    let out = "";
    for (const ch of segment) {
        out += ch === "*" ? "[^.]*" : escapeRegex(ch);
    }
    return out;
}

function matchSegments(patternSegments: string[], pi: number, actualSegments: string[], ai: number): boolean {
    while (true) {
        if (pi === patternSegments.length) return ai === actualSegments.length;
        if (patternSegments[pi] !== "**") {
            if (ai >= actualSegments.length) return false;
            const segRegex = new RegExp(`^${segmentToRegex(patternSegments[pi])}$`);
            if (!segRegex.test(actualSegments[ai])) return false;
            pi++;
            ai++;
            continue;
        }
        for (let skip = ai; skip <= actualSegments.length; skip++) {
            if (matchSegments(patternSegments, pi + 1, actualSegments, skip)) return true;
        }
        return false;
    }
}

function matchClass(classPattern: string, className: string): boolean {
    const normalized = classPattern.replace(/\.\./g, ".**.");
    const patternSegments = normalized.split(".").filter((segment) => segment.length > 0);
    return matchSegments(patternSegments, 0, className.split("."), 0);
}

function matchMethod(methodPattern: string, methodName: string): boolean {
    let regexBody = "";
    for (const ch of methodPattern) {
        regexBody += ch === "*" ? ".*" : escapeRegex(ch);
    }
    return new RegExp(`^${regexBody}$`).test(methodName);
}

export function matchesPointcut(
    parsed: ParsedPointcut,
    className: string,
    methodName: string,
    argCount?: number
): boolean {
    if (!matchMethod(parsed.methodPattern, methodName)) return false;
    if (!matchClass(parsed.classPattern, className)) return false;
    if (argCount !== undefined && !matchesArgs(parsed.argsPattern, argCount)) return false;
    return true;
}
