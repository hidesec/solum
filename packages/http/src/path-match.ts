export function matchPathPattern(pattern: string, path: string): boolean {
    const normalizedPattern = normalizeForMatch(pattern);
    const normalizedPath = normalizeForMatch(path);

    if (normalizedPattern === "/**") return true;

    const patternSegments = normalizedPattern.split("/").filter(Boolean);
    const pathSegments = normalizedPath.split("/").filter(Boolean);

    return matchSegments(patternSegments, 0, pathSegments, 0);
}

function normalizeForMatch(p: string): string {
    const cleaned = p.replace(/\/{2,}/g, "/");
    return cleaned.length > 1 && cleaned.endsWith("/") ? cleaned.slice(0, -1) : cleaned;
}

function matchSegments(pattern: string[], pi: number, actual: string[], ai: number): boolean {
    while (true) {
        if (pi === pattern.length) return ai === actual.length;
        const segment = pattern[pi];
        if (segment === "**") {
            for (let skip = ai; skip <= actual.length; skip++) {
                if (matchSegments(pattern, pi + 1, actual, skip)) return true;
            }
            return false;
        }
        if (ai >= actual.length) return false;
        if (!segmentMatches(segment, actual[ai])) return false;
        pi++;
        ai++;
    }
}

function segmentMatches(patternSegment: string, actualSegment: string): boolean {
    if (patternSegment === "*") return true;
    if (patternSegment.startsWith(":")) return true;
    if (!patternSegment.includes("*")) return patternSegment === actualSegment;

    let regex = "";
    for (const ch of patternSegment) {
        regex += ch === "*" ? "[^/]*" : "\\^$.|?+()[]{}".includes(ch) ? `\\${ch}` : ch;
    }
    return new RegExp(`^${regex}$`).test(actualSegment);
}
