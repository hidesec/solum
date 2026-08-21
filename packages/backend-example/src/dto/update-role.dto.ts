import { IsIn } from "@solumjs/validation";
import { USER_ROLES, UserRole } from "@solumjs/auth";

export class UpdateRoleDto {
    @IsIn(USER_ROLES as unknown as string[])
    role!: UserRole;
}
