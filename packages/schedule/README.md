# @solumjs/schedule

Task scheduling module with cron support for SolumJS.

## Installation

```bash
npm install @solumjs/schedule
```

## Features

- Cron expression parsing
- Interval-based scheduling
- `@Scheduled` decorator
- Timezone support

## Usage

```typescript
import { Scheduled, startScheduledTasks } from "@solumjs/schedule";

class ReportScheduler {
    @Scheduled("0 9 * * 1-5")
    generateDailyReport() {
        console.log("Generating daily report...");
    }

    @Scheduled({ fixedDelay: 60000 })
    cleanupOldData() {
        console.log("Cleaning up...");
    }
}

startScheduledTasks();
```
