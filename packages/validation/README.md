# @solumjs/validation

Validation decorators for SolumJS.

## Installation

```bash
npm install @solumjs/validation
```

## Features

- Property decorators (`@Required`, `@MinLength`, `@MaxLength`, etc.)
- DTO validation
- Custom validators
- Automatic validation in controllers

## Usage

```typescript
import { Required, MinLength, MaxLength, IsEmail, IsInt, Min, Max } from "@solumjs/validation";

class CreateUserDto {
    @Required()
    @MinLength(2)
    @MaxLength(100)
    name!: string;

    @Required()
    @IsEmail()
    email!: string;

    @IsInt()
    @Min(0)
    @Max(150)
    age!: number;
}
```
