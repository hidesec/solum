# @solumjs/validation

Decorator-based DTO validation with 20+ validators.

## Install

```bash
npm install @solumjs/validation
```

## Available Validators

| Category | Decorators |
|----------|-----------|
| Required | `@Required` (import from `@solumjs/validation`) |
| Type | `@IsString`, `@IsNumber`, `@IsBoolean`, `@IsArray`, `@IsInt` |
| Format | `@IsEmail`, `@IsUrl`, `@IsJWT`, `@IsUUID`, `@IsDateString` |
| Length | `@MinLength(n)`, `@MaxLength(n)`, `@Size(min, max)` |
| Range | `@Min(n)`, `@Max(n)`, `@IsPositive`, `@IsNegative` |
| Constraint | `@IsIn(values)`, `@Pattern(regex)`, `@NotEmpty`, `@NotBlank`, `@NotNull` |
| Optional | `@IsOptional` |
| Nested | `@Valid` — validates nested DTOs |

## Usage with Controllers

```typescript
import { RestController, Post, Body } from "@solumjs/http";
import {
    Required, IsEmail, IsOptional, MinLength, MaxLength,
    IsIn, IsUUID, IsNumber, Min, Max, IsArray,
    IsPositive, IsUrl, IsDateString, Pattern,
    IsString, IsBoolean, IsInt, NotEmpty, NotBlank, NotNull,
} from "@solumjs/validation";

export class CreateUserDto {
    @Required()
    @IsString()
    @MinLength(2)
    @MaxLength(100)
    name!: string;

    @Required()
    @IsEmail()
    email!: string;

    @IsOptional()
    @IsString()
    @MinLength(8)
    @Pattern(/^(?=.*[A-Za-z])(?=.*\d)/)
    password?: string;

    @IsOptional()
    @IsIn(["USER", "ADMIN", "MODERATOR"])
    role?: string;

    @IsOptional()
    @IsUrl()
    avatarUrl?: string;
}

export class CreateOrderDto {
    @Required()
    @IsUUID()
    productId!: string;

    @Required()
    @IsNumber()
    @IsPositive()
    quantity!: number;

    @IsOptional()
    @IsString()
    notes?: string;

    @IsOptional()
    @IsArray()
    tags?: string[];
}

@RestController("/users")
export class UserController {

    @Post("/")
    async createUser(@Body() dto: CreateUserDto) {
        return this.userService.createUser(dto);
    }
}
```

## @Valid (Nested Validation)

```typescript
import { Valid } from "@solumjs/validation";

export class OrderDto {
    @Required()
    @Valid()
    customer!: CustomerDto;
}
```

## Options

All validators accept an optional `RuleOptions` parameter:

```typescript
interface RuleOptions {
    groups?: string[]; // Validation groups
}
```

## Programmatic Validation

```typescript
import { getValidationRules } from "@solumjs/validation";

const rules = getValidationRules(CreateUserDto);
// Returns Map<string, ValidationRule[]>
```

## License

MIT
