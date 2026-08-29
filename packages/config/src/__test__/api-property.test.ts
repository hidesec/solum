import { ApiProperty, getAllApiPropertyOptions } from "../api-property.decorator";

describe("ApiProperty decorator", () => {
    it("stores metadata on class", () => {
        class CreateUserDto {
            @ApiProperty({ type: "string", description: "User name", example: "John" })
            name!: string;

            @ApiProperty({ type: "string", format: "email", nullable: true })
            email!: string;
        }

        const options = getAllApiPropertyOptions(CreateUserDto);
        expect(options.size).toBe(2);
        expect(options.get("name")).toEqual({ type: "string", description: "User name", example: "John" });
        expect(options.get("email")).toEqual({ type: "string", format: "email", nullable: true });
    });

    it("returns empty map for class without ApiProperty", () => {
        class Plain {}
        const options = getAllApiPropertyOptions(Plain);
        expect(options.size).toBe(0);
    });

    it("stores enum options", () => {
        class StatusDto {
            @ApiProperty({ enum: ["active", "inactive"], description: "Status" })
            status!: string;
        }
        const options = getAllApiPropertyOptions(StatusDto);
        expect(options.get("status")!.enum).toEqual(["active", "inactive"]);
    });

    it("stores min/max/length/pattern", () => {
        class AgeDto {
            @ApiProperty({ minimum: 0, maximum: 150, type: "integer" })
            age!: number;
        }
        const options = getAllApiPropertyOptions(AgeDto);
        expect(options.get("age")!.minimum).toBe(0);
        expect(options.get("age")!.maximum).toBe(150);
    });

    it("stores deprecated and readOnly flags", () => {
        class LegacyDto {
            @ApiProperty({ deprecated: true, readOnly: true })
            oldField!: string;
        }
        const options = getAllApiPropertyOptions(LegacyDto);
        expect(options.get("oldField")!.deprecated).toBe(true);
        expect(options.get("oldField")!.readOnly).toBe(true);
    });

    it("works with default empty options", () => {
        class MinimalDto {
            @ApiProperty()
            field!: string;
        }
        const options = getAllApiPropertyOptions(MinimalDto);
        expect(options.size).toBe(1);
        expect(options.get("field")).toEqual({});
    });
});
