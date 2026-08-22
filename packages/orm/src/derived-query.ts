import { ColumnMetadata, EntityMetadata } from "./column.decorator";

export type DerivedAction = "find" | "findOne" | "findFirst" | "count" | "exists" | "delete";

export type PredicateOperator =
    | "EQ"
    | "NEQ"
    | "GT"
    | "GTE"
    | "LT"
    | "LTE"
    | "IS_NULL"
    | "IS_NOT_NULL"
    | "TRUE_LITERAL"
    | "FALSE_LITERAL"
    | "BETWEEN"
    | "NOT_BETWEEN"
    | "IN"
    | "NOT_IN"
    | "LIKE"
    | "NOT_LIKE"
    | "CONTAINING"
    | "NOT_CONTAINING"
    | "STARTING_WITH"
    | "ENDING_WITH";

export interface DerivedPredicate {
    connector: "AND" | "OR";
    property: string;
    columnName: string;
    operator: PredicateOperator;
    ignoreCase: boolean;
}

export interface OrderSpec {
    property: string;
    columnName: string;
    direction: "ASC" | "DESC";
}

export interface ParsedDerivedQuery {
    action: DerivedAction;
    predicates: DerivedPredicate[];
    orders: OrderSpec[];
}

const ACTION_PATTERNS: [RegExp, DerivedAction][] = [
    [/^findOneBy/, "findOne"],
    [/^findFirstBy/, "findFirst"],
    [/^findAllBy/, "find"],
    [/^findBy/, "find"],
    [/^readBy/, "find"],
    [/^getBy/, "find"],
    [/^countBy/, "count"],
    [/^existsBy/, "exists"],
    [/^deleteBy/, "delete"],
];

interface OperatorWord {
    word: string;
    not: boolean;
    operator?: PredicateOperator;
    consumesParams: number;
}

const OPERATOR_WORDS: OperatorWord[] = [
    { word: "IsNotNull", not: false, operator: "IS_NOT_NULL", consumesParams: 0 },
    { word: "Null", not: true, operator: "IS_NOT_NULL", consumesParams: 0 },
    { word: "NotNull", not: false, operator: "IS_NOT_NULL", consumesParams: 0 },
    { word: "IsNull", not: false, operator: "IS_NULL", consumesParams: 0 },
    { word: "IsTrue", not: false, operator: "TRUE_LITERAL", consumesParams: 0 },
    { word: "True", not: false, operator: "TRUE_LITERAL", consumesParams: 0 },
    { word: "IsFalse", not: false, operator: "FALSE_LITERAL", consumesParams: 0 },
    { word: "False", not: false, operator: "FALSE_LITERAL", consumesParams: 0 },
    { word: "Is", not: false, operator: "EQ", consumesParams: 1 },
    { word: "Equals", not: false, operator: "EQ", consumesParams: 1 },
    { word: "Equal", not: false, operator: "EQ", consumesParams: 1 },
    { word: "GreaterThanEqual", not: false, operator: "GTE", consumesParams: 1 },
    { word: "GreaterThanEquals", not: false, operator: "GTE", consumesParams: 1 },
    { word: "GreaterThanOrEqual", not: false, operator: "GTE", consumesParams: 1 },
    { word: "GreaterThanEqualTo", not: false, operator: "GTE", consumesParams: 1 },
    { word: "GreaterThan", not: false, operator: "GT", consumesParams: 1 },
    { word: "After", not: false, operator: "GT", consumesParams: 1 },
    { word: "LessThanEqual", not: false, operator: "LTE", consumesParams: 1 },
    { word: "LessThanEquals", not: false, operator: "LTE", consumesParams: 1 },
    { word: "LessThanOrEqual", not: false, operator: "LTE", consumesParams: 1 },
    { word: "LessThanOrEqualTo", not: false, operator: "LTE", consumesParams: 1 },
    { word: "LessThan", not: false, operator: "LT", consumesParams: 1 },
    { word: "Before", not: false, operator: "LT", consumesParams: 1 },
    { word: "NotBetween", not: true, operator: "BETWEEN", consumesParams: 2 },
    { word: "Between", not: false, operator: "BETWEEN", consumesParams: 2 },
    { word: "NotIn", not: true, operator: "IN", consumesParams: 1 },
    { word: "In", not: false, operator: "IN", consumesParams: 1 },
    { word: "NotLike", not: true, operator: "LIKE", consumesParams: 1 },
    { word: "Like", not: false, operator: "LIKE", consumesParams: 1 },
    { word: "NotContaining", not: true, operator: "CONTAINING", consumesParams: 1 },
    { word: "Containing", not: false, operator: "CONTAINING", consumesParams: 1 },
    { word: "StartsWith", not: false, operator: "STARTING_WITH", consumesParams: 1 },
    { word: "StartingWith", not: false, operator: "STARTING_WITH", consumesParams: 1 },
    { word: "EndsWith", not: false, operator: "ENDING_WITH", consumesParams: 1 },
    { word: "EndingWith", not: false, operator: "ENDING_WITH", consumesParams: 1 },
].map((w) => ({ ...w, operator: w.not ? negate(w.operator as PredicateOperator) : (w.operator as PredicateOperator) }));

function negate(operator: PredicateOperator): PredicateOperator {
    switch (operator) {
        case "IS_NULL": return "IS_NOT_NULL";
        case "BETWEEN": return "NOT_BETWEEN";
        case "IN": return "NOT_IN";
        case "LIKE": return "NOT_LIKE";
        case "CONTAINING": return "NOT_CONTAINING";
        default: return "NEQ";
    }
}

const SORTED_OPERATOR_WORDS = [...OPERATOR_WORDS].sort((a, b) => b.word.length - a.word.length);

function normalize(text: string): string {
    return text.toLowerCase();
}

function matchPropertyChain(
    subject: string,
    position: number,
    properties: Map<string, ColumnMetadata>
): ColumnMetadata | null {
    let best: ColumnMetadata | null = null;
    const lowerSubject = subject.slice(position).toLowerCase();

    for (const [propertyName, column] of properties) {
        if (!column.propertyName) continue;
        const candidate = normalize(propertyName);
        if (candidate.startsWith("_")) continue;
        if (lowerSubject.startsWith(candidate)) {
            if (!best || candidate.length > best.propertyName.length) best = column;
        }
    }

    return best;
}

function parseOrderSpecs(specsText: string, meta: EntityMetadata): OrderSpec[] {
    const properties = new Map(meta.columns.map((c) => [c.propertyName, c] as const));
    const text = specsText.replace(/,/g, "");
    const specs: OrderSpec[] = [];
    let position = 0;

    while (position < text.length) {
        const column = matchPropertyChain(text, position, properties);
        if (!column) {
            throw new Error(
                `Cannot resolve property at position ${position} in OrderBy clause "${specsText}". ` +
                `Available columns: ${[...properties.keys()].join(", ")}`
            );
        }
        position += column.propertyName.length;

        let direction: "ASC" | "DESC" = "ASC";
        if (text.startsWith("Desc", position)) {
            direction = "DESC";
            position += 4;
        } else if (text.startsWith("Asc", position)) {
            position += 3;
        }

        specs.push({ property: column.propertyName, columnName: column.columnName, direction });
    }

    return specs;
}

export function parseDerivedMethodName(methodName: string, meta: EntityMetadata): ParsedDerivedQuery {
    let action: DerivedAction | undefined;
    let subject: string | undefined;

    for (const [pattern, parsedAction] of ACTION_PATTERNS) {
        if (pattern.test(methodName)) {
            action = parsedAction;
            subject = methodName.replace(pattern, "");
            break;
        }
    }

    if (!action || subject === undefined) {
        throw new Error(
            `"${methodName}" is not a supported derived query name. ` +
            `Use findBy*, findOneBy*, findAllBy*, countBy*, existsBy* or deleteBy*.`
        );
    }

    const orderByIndex = subject.lastIndexOf("OrderBy");
    let orderSpecs: OrderSpec[] = [];

    if (orderByIndex !== -1 && orderByIndex + "OrderBy".length < subject.length) {
        const specsText = subject.slice(orderByIndex + "OrderBy".length);
        orderSpecs = parseOrderSpecs(specsText, meta);
        subject = subject.slice(0, orderByIndex);
    }

    if (subject.length === 0) {
        return { action, predicates: [], orders: orderSpecs };
    }

    const properties = new Map<string, ColumnMetadata>(
        meta.columns.map((c) => [c.propertyName, c] as const)
    );

    const predicates: DerivedPredicate[] = [];
    let position = 0;
    let connector: "AND" | "OR" = "AND";

    while (position < subject.length) {
        if (predicates.length > 0) {
            if (subject.startsWith("And", position)) {
                connector = "AND";
                position += 3;
            } else if (subject.startsWith("Or", position)) {
                connector = "OR";
                position += 2;
            } else {
                throw new Error(`Expected "And" or "Or" at position ${position} in "${methodName}"`);
            }
        }

        const column = matchPropertyChain(subject, position, properties);
        if (!column) {
            throw new Error(
                `Cannot resolve property at position ${position} in "${methodName}". ` +
                `Available columns: ${[...properties.keys()].join(", ")}`
            );
        }
        position += column.propertyName.length;

        let operator: PredicateOperator = "EQ";
        let ignoreCase = false;
        let consumedOperator = false;

        const rest = subject.slice(position);

        if (rest.startsWith("IgnoreCase")) {
            ignoreCase = true;
            position += "IgnoreCase".length;
        }

        for (const op of SORTED_OPERATOR_WORDS) {
            if (subject.startsWith(op.word, position) && op.operator) {
                operator = op.operator;
                position += op.word.length;
                consumedOperator = true;
                break;
            }
        }

        if (!consumedOperator && !ignoreCase) {
            const afterProperty = subject.slice(position);
            if (afterProperty.startsWith("Not")) {
                operator = "NEQ";
                position += "Not".length;
            }
        }

        if (!consumedOperator) {
            const restAfterModifiers = subject.slice(position);
            if (restAfterModifiers.startsWith("IgnoreCase")) {
                ignoreCase = true;
                position += "IgnoreCase".length;
            }
        }

        predicates.push({
            connector,
            property: column.propertyName,
            columnName: column.columnName,
            operator,
            ignoreCase,
        });

        if (
            predicates.length > 0 &&
            position < subject.length &&
            !subject.startsWith("And", position) &&
            !subject.startsWith("Or", position)
        ) {
            const remaining = subject.slice(position);
            if (!remaining.startsWith("IgnoreCase")) {
                throw new Error(`Unexpected token "${remaining}" in derived query "${methodName}"`);
            }
        }
    }

    return { action, predicates, orders: orderSpecs };
}

export interface BoundCondition {
    connector: "AND" | "OR";
    sql: string;
    params: unknown[];
}

const PARAM_OPS: Partial<Record<PredicateOperator, string>> = {
    EQ: "=",
    NEQ: "!=",
    GT: ">",
    GTE: ">=",
    LT: "<",
    LTE: "<=",
};

export function bindPredicates(
    predicates: DerivedPredicate[],
    args: unknown[],
    quoteIdentifier?: (id: string) => string
): BoundCondition[] {
    let argIndex = 0;
    const col = (predicate: DerivedPredicate): string =>
        quoteIdentifier ? quoteIdentifier(predicate.columnName) : predicate.columnName;

    const nextArg = (): unknown => {
        if (argIndex >= args.length) {
            throw new Error(
                `Missing query parameter ${argIndex + 1}. Expected more arguments for derived query conditions.`
            );
        }
        return args[argIndex++];
    };

    return predicates.map((predicate) => {
        const columnRef = () => col(predicate);

        switch (predicate.operator) {
            case "IS_NULL":
                return { connector: predicate.connector, sql: `${columnRef()} IS NULL`, params: [] };
            case "IS_NOT_NULL":
                return { connector: predicate.connector, sql: `${columnRef()} IS NOT NULL`, params: [] };
            case "TRUE_LITERAL":
                return { connector: predicate.connector, sql: `${columnRef()} = TRUE`, params: [] };
            case "FALSE_LITERAL":
                return { connector: predicate.connector, sql: `${columnRef()} = FALSE`, params: [] };
            case "BETWEEN":
                return {
                    connector: predicate.connector,
                    sql: `${columnRef()} BETWEEN ? AND ?`,
                    params: [nextArg(), nextArg()],
                };
            case "NOT_BETWEEN":
                return {
                    connector: predicate.connector,
                    sql: `${columnRef()} NOT BETWEEN ? AND ?`,
                    params: [nextArg(), nextArg()],
                };
            case "IN": {
                const value = nextArg();
                if (!Array.isArray(value)) {
                    throw new Error(`${predicate.property}In expects an array argument`);
                }
                const placeholders = value.map(() => "?").join(", ");
                return {
                    connector: predicate.connector,
                    sql: `${columnRef()} IN (${placeholders})`,
                    params: value,
                };
            }
            case "NOT_IN": {
                const value = nextArg();
                if (!Array.isArray(value)) {
                    throw new Error(`${predicate.property}NotIn expects an array argument`);
                }
                const placeholders = value.map(() => "?").join(", ");
                return {
                    connector: predicate.connector,
                    sql: `${columnRef()} NOT IN (${placeholders})`,
                    params: value,
                };
            }
            case "LIKE": {
                if (predicate.ignoreCase) {
                    return {
                        connector: predicate.connector,
                        sql: `LOWER(${columnRef()}) LIKE LOWER(?)`,
                        params: [nextArg()],
                    };
                }
                return { connector: predicate.connector, sql: `${columnRef()} ILIKE ?`, params: [nextArg()] };
            }
            case "NOT_LIKE": {
                if (predicate.ignoreCase) {
                    return {
                        connector: predicate.connector,
                        sql: `LOWER(${columnRef()}) NOT LIKE LOWER(?)`,
                        params: [nextArg()],
                    };
                }
                return { connector: predicate.connector, sql: `${columnRef()} NOT ILIKE ?`, params: [nextArg()] };
            }
            case "CONTAINING":
            case "NOT_CONTAINING": {
                const negation = predicate.operator === "NOT_CONTAINING" ? "NOT " : "";
                const value = `%${escapeLike(String(nextArg()))}%`;
                if (predicate.ignoreCase) {
                    return {
                        connector: predicate.connector,
                        sql: `LOWER(${columnRef()}) ${negation}LIKE LOWER(?)`,
                        params: [value],
                    };
                }
                return {
                    connector: predicate.connector,
                    sql: `${columnRef()} ${negation}ILIKE ?`,
                    params: [value],
                };
            }
            case "STARTING_WITH": {
                const value = `${escapeLike(String(nextArg()))}%`;
                if (predicate.ignoreCase) {
                    return {
                        connector: predicate.connector,
                        sql: `LOWER(${columnRef()}) LIKE LOWER(?)`,
                        params: [value],
                    };
                }
                return { connector: predicate.connector, sql: `${columnRef()} ILIKE ?`, params: [value] };
            }
            case "ENDING_WITH": {
                const value = `%${escapeLike(String(nextArg()))}`;
                if (predicate.ignoreCase) {
                    return {
                        connector: predicate.connector,
                        sql: `LOWER(${columnRef()}) LIKE LOWER(?)`,
                        params: [value],
                    };
                }
                return { connector: predicate.connector, sql: `${columnRef()} ILIKE ?`, params: [value] };
            }
            default: {
                const sqlOperator = PARAM_OPS[predicate.operator];
                if (!sqlOperator) {
                    throw new Error(`Unsupported operator "${predicate.operator}"`);
                }
                const value = nextArg();
                if (predicate.ignoreCase && typeof value === "string") {
                    return {
                        connector: predicate.connector,
                        sql: `LOWER(${columnRef()}) = LOWER(?)`,
                        params: [value],
                    };
                }
                return {
                    connector: predicate.connector,
                    sql: `${columnRef()} ${sqlOperator} ?`,
                    params: [value],
                };
            }
        }
    });
}

export function isDerivedQueryName(methodName: string): boolean {
    return ACTION_PATTERNS.some(([pattern]) => pattern.test(methodName));
}

export function escapeLike(value: string): string {
    return value.replace(/([%_\\])/g, "\\$1");
}
