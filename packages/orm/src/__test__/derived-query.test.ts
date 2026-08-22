import { Column, ColumnType, CreatedAtColumn, Entity, EntityMetadata, getEntityMetadata, PrimaryGeneratedColumn, VersionColumn } from "../column.decorator";
import { ParsedDerivedQuery, parseDerivedMethodName } from "../derived-query";

@Entity("derived_users")
class DerivedUser {
    @PrimaryGeneratedColumn(ColumnType.UUID)
    id!: string;

    @Column({ type: ColumnType.VARCHAR })
    email!: string;

    @Column({ type: ColumnType.VARCHAR })
    status!: string;

    @Column({ type: ColumnType.INTEGER })
    age!: number;

    @CreatedAtColumn()
    createdAt!: Date;

    @VersionColumn()
    version!: number;
}

function parse(name: string): ParsedDerivedQuery {
    const meta = getEntityMetadata(DerivedUser) as EntityMetadata;
    return parseDerivedMethodName(name, meta);
}

describe("derived query method parser", () => {
    it("parses simple findBy with single property", () => {
        const parsed = parse("findByEmail");
        expect(parsed.action).toBe("find");
        expect(parsed.predicates).toEqual([
            { connector: "AND", property: "email", columnName: "email", operator: "EQ", ignoreCase: false },
        ]);
        expect(parsed.orders).toEqual([]);
    });

    it("maps snake_case columns via metadata", () => {
        const parsed = parse("findByStatus");
        expect(parsed.predicates[0].columnName).toBe("status");
    });

    it("parses And chains", () => {
        const parsed = parse("findByEmailAndStatus");
        expect(parsed.predicates.map((p) => [p.property, p.connector])).toEqual([
            ["email", "AND"],
            ["status", "AND"],
        ]);
    });

    it("parses Or chains", () => {
        const parsed = parse("findByEmailOrStatus");
        expect(parsed.predicates.map((p) => p.connector)).toEqual(["AND", "OR"]);
    });

    it("parses comparison operators", () => {
        expect(parse("findByAgeGreaterThan").predicates[0].operator).toBe("GT");
        expect(parse("findByAgeGreaterThanEqual").predicates[0].operator).toBe("GTE");
        expect(parse("findByAgeLessThan").predicates[0].operator).toBe("LT");
        expect(parse("findByAgeLessThanEqual").predicates[0].operator).toBe("LTE");
        expect(parse("findByAgeBetween").predicates[0].operator).toBe("BETWEEN");
    });

    it("parses collection and pattern operators", () => {
        expect(parse("findByStatusIn").predicates[0].operator).toBe("IN");
        expect(parse("findByStatusNotIn").predicates[0].operator).toBe("NOT_IN");
        expect(parse("findByEmailContaining").predicates[0].operator).toBe("CONTAINING");
        expect(parse("findByEmailNotContaining").predicates[0].operator).toBe("NOT_CONTAINING");
        expect(parse("findByEmailStartingWith").predicates[0].operator).toBe("STARTING_WITH");
        expect(parse("findByEmailEndingWith").predicates[0].operator).toBe("ENDING_WITH");
        expect(parse("findByEmailLike").predicates[0].operator).toBe("LIKE");
        expect(parse("findByEmailNotLike").predicates[0].operator).toBe("NOT_LIKE");
    });

    it("parses null, boolean literals and Not suffix", () => {
        expect(parse("findByEmailIsNull").predicates[0].operator).toBe("IS_NULL");
        expect(parse("findByEmailIsNotNull").predicates[0].operator).toBe("IS_NOT_NULL");
        expect(parse("findByEmailNotNull").predicates[0].operator).toBe("IS_NOT_NULL");

        const active = parse("findByStatusTrue");
        expect(active.predicates[0].operator).toBe("TRUE_LITERAL");
        expect(parse("findByStatusFalse").predicates[0].operator).toBe("FALSE_LITERAL");

        expect(parse("findByEmailNot").predicates[0].operator).toBe("NEQ");
    });

    it("parses IgnoreCase modifier", () => {
        const parsed = parse("findByEmailIgnoreCase");
        expect(parsed.predicates[0].ignoreCase).toBe(true);
        expect(parsed.predicates[0].operator).toBe("EQ");
    });

    it("distinguishes actions", () => {
        expect(parse("findOneByEmail").action).toBe("findOne");
        expect(parse("findFirstByStatus").action).toBe("findFirst");
        expect(parse("findAllByStatus").action).toBe("find");
        expect(parse("countByStatus").action).toBe("count");
        expect(parse("existsByEmail").action).toBe("exists");
        expect(parse("deleteByStatus").action).toBe("delete");
    });

    it("parses OrderBy clause with direction", () => {
        const parsed = parse("findByStatusOrderByAgeDesc");
        expect(parsed.orders).toEqual([{ property: "age", columnName: "age", direction: "DESC" }]);
        expect(parsed.predicates).toHaveLength(1);
    });

    it("parses multiple order specs", () => {
        const parsed = parse("findByStatusOrderByAgeDesc,EmailAsc");
        expect(parsed.orders).toEqual([
            { property: "age", columnName: "age", direction: "DESC" },
            { property: "email", columnName: "email", direction: "ASC" },
        ]);
    });

    it("rejects unknown properties with helpful error", () => {
        expect(() => parse("findByUnknownProperty")).toThrow(/Cannot resolve property/);
    });

    it("rejects non-derived names", () => {
        expect(() => parse("doSomethingElse")).toThrow(/not a supported derived query name/);
    });
});
