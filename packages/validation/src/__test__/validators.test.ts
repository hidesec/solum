import { IsInt, IsOptional, IsString, Max, Min, MinLength, NotBlank, NotEmpty, Pattern, Size } from "../decorators";
import { validateInstance } from "../validate";

class CreateDto {
    @IsString()
    @NotBlank()
    name!: string;

    @Min(1)
    @Max(120)
    age!: number;
}

describe("extended validators", () => {
    it("Size validates string length bounds", () => {
        class D {
            @Size(2, 4)
            value!: string;
        }
        expect(validateInstance(new D()).map((e) => e.property)).toEqual(["value"]);

        const ok = new D();
        ok.value = "abcd";
        expect(validateInstance(ok)).toHaveLength(0);

        const tooLong = new D();
        tooLong.value = "abcde";
        expect(validateInstance(tooLong)).toHaveLength(1);
    });

    it("Pattern validates against regex", () => {
        class D {
            @Pattern("^a+$")
            value!: string;
        }
        const good = new D();
        good.value = "aaa";
        expect(validateInstance(good)).toHaveLength(0);

        const bad = new D();
        bad.value = "bbb";
        expect(validateInstance(bad)[0].constraints).toHaveProperty(
            "pattern",
            expect.stringContaining('must match "^a+$"')
        );
    });

    it("Min and Max reject non-numbers", () => {
        const bad = new CreateDto();
        (bad as any).age = "12";
        expect(validateInstance(bad).map((e) => e.property)).toContain("age");
    });

    it("Not rejects values below bound", () => {
        const dto = new CreateDto();
        dto.name = "x";
        (dto as any).age = 0;
        expect(validateInstance(dto)[0].property).toBe("age");
    });

    it("NotEmpty and NotBlank", () => {
        class D {
            @NotEmpty()
            list!: unknown[];

            @NotBlank()
            text!: string;
        }
        const d = new D();
        d.list = [];
        d.text = "   ";
        const errors = validateInstance(d);
        expect(errors.map((e) => e.property).sort()).toEqual(["list", "text"]);
    });

    it("IsInt distinguishes integers from floats", () => {
        class D {
            @IsInt()
            count!: number;
        }
        const ok = new D();
        ok.count = 3;
        expect(validateInstance(ok)).toHaveLength(0);

        const bad = new D();
        bad.count = 3.5;
        expect(validateInstance(bad)).toHaveLength(1);
    });
});

class GroupedDto {
    @MinLength(2)
    name!: string;

    @IsOptional()
    @Pattern("^\\d{4}$")
    promoCode?: string;

    @Min(18, { groups: ["register"] })
    age?: number;
}

describe("validation groups", () => {
    it("ignores grouped rules when no groups selected", () => {
        const dto = new GroupedDto();
        dto.name = "ab";
        (dto as any).age = 10;
        expect(validateInstance(dto)).toHaveLength(0);
    });

    it("applies grouped rules when group selected", () => {
        const dto = new GroupedDto();
        dto.name = "ab";
        (dto as any).age = 10;
        const errors = validateInstance(dto, { groups: ["register"] });
        expect(errors.map((e) => e.property)).toEqual(["age"]);
    });

    it("ungrouped rules still apply alongside groups", () => {
        const dto = new GroupedDto();
        dto.name = "a";
        const errors = validateInstance(dto, { groups: ["register"] });
        expect(errors.map((e) => e.property).sort()).toEqual(["age", "name"]);
    });
});
