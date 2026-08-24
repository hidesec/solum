import { Bean } from "@solumjs/core";
import { PostConstruct } from "@solumjs/core";
import { logger } from "@config/logger";

interface UserCreatedPayload {
    userId: string;
    email: string;
}

interface OrderPlacedPayload {
    orderId: string;
    userId: string;
    total: number;
}

/**
 * EmailNotificationService handles all email-related operations.
 * Called by event listeners (e.g., UserCreatedListener) rather than
 * listening to events directly, to avoid duplicate event consumption.
 */
@Bean()
export class EmailNotificationService {
    @PostConstruct()
    init() {
        logger.info("[@PostConstruct] EmailNotificationService initialized");
    }

    async sendWelcomeEmail(payload: UserCreatedPayload): Promise<void> {
        logger.info(
            { audit: true, event: "USER_CREATED", ...payload },
            `[EmailNotification] Sending welcome email to ${payload.email}`
        );

        // In production, this would call an actual SMTP service:
        // await this.mailService.send({ to: payload.email, subject: "Welcome!", ... })
        logger.info({ userId: payload.userId }, "[EmailNotification] Welcome email sent successfully");
    }

    async sendOrderConfirmation(payload: OrderPlacedPayload): Promise<void> {
        logger.info(
            { audit: true, event: "ORDER_PLACED", ...payload },
            `[EmailNotification] Sending order confirmation for order ${payload.orderId}`
        );
        logger.info({ orderId: payload.orderId }, "[EmailNotification] Order confirmation email sent");
    }
}
