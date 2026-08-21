import { User } from "@entities/user.entity";
import { IBaseRepository } from "@solumjs/database";

export interface IUserRepository extends IBaseRepository<User, string> {
    findByEmail(email: string): Promise<User | null>;
    findRecentByEmails(emails: string[], limit: number): Promise<User[]>;
}