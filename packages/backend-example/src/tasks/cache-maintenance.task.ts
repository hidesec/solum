import { logger } from "@config/logger";
import { Bean } from "@solumjs/core";
import { cacheManager } from "@solumjs/cache";
import { Scheduled } from "@solumjs/schedule";

@Bean()
export class CacheMaintenanceTask {
    @Scheduled("*/10 * * * *")
    async sweepExpiredCacheEntries(): Promise<void> {
        const removed = await cacheManager.sweep();
        if (removed > 0) {
            logger.info({ removed }, "Expired cache entries swept");
        }
    }
}
