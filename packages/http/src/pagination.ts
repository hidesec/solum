export type SortDirection = "ASC" | "DESC";

export interface Sort {
    column: string;
    direction: SortDirection;
}

export class PageRequest {
    private constructor(
        public readonly page: number,
        public readonly size: number,
        public readonly sorts: Sort[]
    ) {}

    static of(page: number = 1, size: number = 20, sorts: Sort[] = []): PageRequest {
        const safePage = Number.isFinite(page) && page >= 1 ? Math.floor(page) : 1;
        const safeSize = Number.isFinite(size) ? Math.min(Math.max(Math.floor(size), 1), 100) : 20;
        return new PageRequest(safePage, safeSize, sorts);
    }

    get offset(): number {
        return (this.page - 1) * this.size;
    }
}

export interface Page<T> {
    content: T[];
    page: number;
    size: number;
    totalElements: number;
    totalPages: number;
    first: boolean;
    last: boolean;
}

export function buildPage<T>(content: T[], request: PageRequest, totalElements: number): Page<T> {
    const totalPages = Math.max(Math.ceil(totalElements / request.size), 1);
    return {
        content,
        page: request.page,
        size: request.size,
        totalElements,
        totalPages,
        first: request.page <= 1,
        last: request.page >= totalPages,
    };
}

const COLUMN_PATTERN = /^[a-zA-Z0-9_]+$/;

export function parseSort(raw: unknown): Sort[] {
    if (typeof raw !== "string" || raw.trim() === "") return [];

    return raw
        .split(";")
        .map((part) => {
            const [column, direction] = part.split(",").map((s) => s.trim());
            return {
                column,
                direction: direction?.toUpperCase() === "DESC" ? ("DESC" as const) : ("ASC" as const),
            };
        })
        .filter((sort) => COLUMN_PATTERN.test(sort.column));
}

export function parsePageable(query: Record<string, unknown>, defaultSize: number = 20): PageRequest {
    const page = parseInt(String(query["page"] ?? "1"), 10);
    const size = parseInt(String(query["size"] ?? String(defaultSize)), 10);
    return PageRequest.of(
        Number.isNaN(page) ? 1 : page,
        Number.isNaN(size) ? defaultSize : size,
        parseSort(query["sort"])
    );
}
