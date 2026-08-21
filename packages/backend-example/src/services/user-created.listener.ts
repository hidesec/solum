import { logger } from "@config/logger";
import { Bean } from "@solumjs/core";
import { EventListener } from "@solumjs/events";

interface UserCreatedPayload {
    userId: string;
    email: string;
}

@Bean()
export class UserCreatedListener {
    @EventListener("USER_CREATED")
    async onUserCreated(payload: UserCreatedPayload): Promise<void> {
        logger.info(
            { audit: true, event: "USER_CREATED", ...payload },
            `Welcome email queued for ${payload.email}`
        );
    }
}
