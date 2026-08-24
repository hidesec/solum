import { Bean } from "@solumjs/core";
import { Retry, CircuitBreakerDec } from "@solumjs/core";
import { logger } from "@config/logger";

interface ExternalPaymentResponse {
    success: boolean;
    transactionId: string;
}

/**
 * Example service demonstrating resilience patterns:
 * - @Retry for transient failure recovery with exponential backoff
 * - @CircuitBreakerDec for cascading failure prevention
 *
 * In production, these decorators would be applied to external API calls,
 * database operations, or any I/O-bound work that can fail transiently.
 */
@Bean()
export class PaymentGatewayService {
    private attemptCount = 0;

    @Retry({ maxAttempts: 3, backoffMs: 1000, backoffMultiplier: 2 })
    async processPayment(orderId: string, amount: number): Promise<ExternalPaymentResponse> {
        this.attemptCount++;
        logger.info({ orderId, amount, attempt: this.attemptCount }, "[PaymentGateway] Processing payment");

        // Simulate external payment gateway call
        // In production, this would be an actual HTTP call to a payment provider
        if (this.attemptCount % 3 === 0) {
            // Simulate success on 3rd attempt
            this.attemptCount = 0;
            return { success: true, transactionId: `txn_${orderId}` };
        }

        throw new Error(`Payment gateway timeout (attempt ${this.attemptCount})`);
    }

    @CircuitBreakerDec({ failureThreshold: 5, resetTimeoutMs: 30000 })
    async checkInventory(sku: string): Promise<{ available: boolean; stock: number }> {
        logger.info({ sku }, "[PaymentGateway] Checking inventory");

        // Simulate inventory check
        // In production, this would call an inventory service
        return { available: true, stock: 42 };
    }
}
