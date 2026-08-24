import { logger } from "@config/logger";
import { Bean, inject } from "@solumjs/core";
import { TransactionalEventListener } from "@solumjs/events";
import { EmailNotificationService } from "./email-notification.service";

interface UserCreatedPayload {
    userId: string;
    email: string;
}

/**
 * UserCreatedListener delegates to EmailNotificationService.
 * The event is consumed here and forwarded to the email service
 * which handles the actual email sending.
 */
@Bean()
export class UserCreatedListener {
    constructor(
        @inject(EmailNotificationService)
        private readonly emailService: EmailNotificationService
    ) {}

    @TransactionalEventListener("USER_CREATED")
    async onUserCreated(payload: UserCreatedPayload): Promise<void> {
        logger.info(
            { audit: true, event: "USER_CREATED", ...payload },
            `[UserCreatedListener] Delegating to EmailNotificationService for ${payload.email}`
        );
        await (this.emailService as any).onUserCreated(payload);
    }
}
