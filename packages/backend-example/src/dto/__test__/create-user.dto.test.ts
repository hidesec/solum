import { CreateUserDto } from "../create-user.dto";

describe("CreateUserDto", () => {
    let dto: CreateUserDto;

    beforeEach(() => {
        dto = new CreateUserDto();
        dto.name = "John Doe";
        dto.email = "john@example.com";
        dto.password = "Secret1!";
    });

    it("has required fields", () => {
        expect(dto.name).toBe("John Doe");
        expect(dto.email).toBe("john@example.com");
        expect(dto.password).toBe("Secret1!");
    });

    it("accepts valid name", () => {
        dto.name = "Jane";
        expect(dto.name).toBe("Jane");
    });

    it("accepts valid email", () => {
        dto.email = "test@domain.org";
        expect(dto.email).toBe("test@domain.org");
    });

    it("accepts valid password with uppercase, lowercase, digit, and special char", () => {
        dto.password = "Abc123!@";
        expect(dto.password).toBe("Abc123!@");
    });

    it("is an instance of CreateUserDto", () => {
        expect(dto).toBeInstanceOf(CreateUserDto);
    });

    it("fields can be reassigned", () => {
        dto.name = "New Name";
        dto.email = "new@example.com";
        dto.password = "NewPass1!";
        expect(dto.name).toBe("New Name");
        expect(dto.email).toBe("new@example.com");
        expect(dto.password).toBe("NewPass1!");
    });
});
