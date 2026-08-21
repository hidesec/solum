import { Bean } from "@solumjs/decorators";
import { BaseRepository } from "@solumjs/database";
import { IUserRepository } from "./user.repository.interface";
import { User } from "@entities/user.entity";

@Bean("IUserRepository")
export class UserRepository extends BaseRepository<User, string> implements IUserRepository {
    protected readonly entityCtor = User;

    async findByEmail(email: string): Promise<User | null> {
        return this.query().where("email", email).first();
    }

    async findRecentByEmails(emails: string[], limit: number): Promise<User[]> {
        return this.query()
            .whereIn("email", emails)
            .orderBy("created_at", "DESC")
            .limit(limit)
            .get();
    }
}