import { CreateUserDto } from "@dto/create-user.dto";
import { User } from "@entities/user.entity";
import { Page, PageRequest } from "@solumjs/http";
import { UserRole } from "@solumjs/auth";

export interface IUserService {
    createUser(dto: CreateUserDto): Promise<User>;
    getUserById(id: string): Promise<User>;
    findRecentByEmails(emails: string[], limit: number): Promise<User[]>;
    findPage(request: PageRequest): Promise<Page<User>>;
    deleteUser(id: string): Promise<void>;
    updateRole(id: string, role: UserRole): Promise<User>;
}
