import { User } from "@entities/user.entity";

export class UserResponseDto {
    id: string;
    name: string;
    email: string;
    role: string;
    createdAt: Date;

    constructor(user: User) {
        this.id = user.id;
        this.name = user.name;
        this.email = user.email;
        this.role = user.role;
        this.createdAt = user.createdAt;
    }

    static fromEntity(user: User): UserResponseDto {
        return new UserResponseDto(user);
    }
}
