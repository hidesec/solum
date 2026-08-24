# @solumjs/schedule

Task scheduling with cron expressions and intervals.

## Install

```bash
npm install @solumjs/schedule
```

## @Scheduled with Cron

```typescript
import { Scheduled, startScheduledTasks, stopScheduledTasks } from "@solumjs/schedule";
import { Bean } from "@solumjs/core";

@Bean("ICacheMaintenanceTask")
export class CacheMaintenanceTask {

    @Scheduled("0 * * * *") // Every hour
    async cleanExpiredCache() {
        console.log("Cleaning expired cache entries...");
    }

    @Scheduled("*/30 * * * *") // Every 30 minutes
    async refreshMetrics() {
        console.log("Refreshing metrics...");
    }

    @Scheduled("0 2 * * *", { zone: "America/New_York" }) // 2 AM EST
    async dailyCleanup() {
        console.log("Running daily cleanup...");
    }
}
```

## @Scheduled with Interval

```typescript
@Bean("IHealthChecker")
export class HealthChecker {

    @Scheduled("30s") // Every 30 seconds
    async checkHealth() {
        console.log("Checking health...");
    }

    @Scheduled("5m") // Every 5 minutes
    async cleanupTempFiles() {
        console.log("Cleaning up...");
    }
}
```

## @Scheduled with fixedDelay

```typescript
@Bean("IPollingTask")
export class PollingTask {

    @Scheduled({ fixedDelay: 10000 }) // Fixed delay between executions
    async pollingTask() {
        console.log("Polling...");
    }
}
```

## Start/Stop

```typescript
import { startScheduledTasks, stopScheduledTasks } from "@solumjs/schedule";

// Start all registered scheduled tasks
startScheduledTasks();

// Stop all scheduled tasks
stopScheduledTasks();
```

## Cron Syntax

```
.------------------- minute (0-59)
|  .---------------- hour (0-23)
|  |  .------------- day of month (1-31)
|  |  |  .---------- month (1-12)
|  |  |  |  .------- day of week (0-6, Sunday=0)
|  |  |  |  |
*  *  *  *  *
```

## Interval Syntax

- `500ms` — milliseconds
- `30s` — seconds
- `5m` — minutes
- `1h` — hours

## Options

```typescript
interface ScheduledOptions {
    zone?: string;     // Timezone (e.g., "America/New_York")
    fixedDelay?: number; // Fixed delay in ms between executions
}
```

## License

MIT
