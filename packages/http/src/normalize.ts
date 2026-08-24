export function normalizePath(p: string): string {
    const cleaned = p.replace(/\/{2,}/g, "/");
    return cleaned.length > 1 && cleaned.endsWith("/") ? cleaned.slice(0, -1) : cleaned || "/";
}
