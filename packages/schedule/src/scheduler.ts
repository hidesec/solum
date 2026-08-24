import "@solumjs/core";
import { container } from "@solumjs/core";
import { getFrameworkLogger } from "@solumjs/core";

interface ScheduledTask {
    className: string;
    methodName: string;
    expression: string;
    target: Function;
    zone?: string;
    fixedDelay?: number;
}

const tasks: ScheduledTask[] = [];
const timers: NodeJS.Timeout[] = [];

export interface ScheduledOptions {
    zone?: string;
    fixedDelay?: number;
}

export function Scheduled(expressionOrOptions: string | ScheduledOptions): MethodDecorator {
    return function (target: any, propertyKey: string | symbol, _descriptor?: PropertyDescriptor) {
        const destination = target.constructor ?? target;
        let expression: string;
        let zone: string | undefined;
        let fixedDelay: number | undefined;

        if (typeof expressionOrOptions === "string") {
            expression = expressionOrOptions;
        } else {
            expression = expressionOrOptions.zone ? "* * * * *" : "* * * * *";
            zone = expressionOrOptions.zone;
            fixedDelay = expressionOrOptions.fixedDelay;
        }

        tasks.push({
            className: destination.name,
            methodName: propertyKey as string,
            expression,
            target: destination,
            zone,
            fixedDelay,
        });
    };
}

interface CronFields {
    minutes: Set<number>;
    hours: Set<number>;
    daysOfMonth: Set<number>;
    months: Set<number>;
    daysOfWeek: Set<number>;
}

function parseField(field: string, min: number, max: number): Set<number> {
    const values = new Set<number>();

    for (const part of field.split(",")) {
        const [range, stepStr] = part.split("/");
        const step = stepStr ? parseInt(stepStr, 10) : 1;
        if (!Number.isFinite(step) || step < 1) {
            throw new Error(`Invalid step in cron field "${field}"`);
        }

        let start = min;
        let end = max;
        if (range !== "*") {
            const [from, to] = range.split("-");
            start = parseInt(from, 10);
            end = to !== undefined ? parseInt(to, 10) : start;
        }
        if (!Number.isFinite(start) || !Number.isFinite(end) || start < min || end > max || start > end) {
            throw new Error(`Invalid cron field "${field}"`);
        }

        for (let value = start; value <= end; value += step) {
            values.add(value);
        }
    }

    return values;
}

export function parseFieldForTest(field: string, min: number, max: number): Set<number> {
    return parseField(field, min, max);
}

export function parseCronForTest(expression: string): CronFields {
    return parseCron(expression);
}

export function parseIntervalMsForTest(expression: string): number {
    return parseIntervalMs(expression);
}

export function nextCronDateForTest(fields: CronFields, from: Date): Date {
    return nextCronDate(fields, from);
}

export function isCronForTest(expression: string): boolean {
    return isCron(expression);
}

function parseCron(expression: string): CronFields {
    const parts = expression.trim().split(/\s+/);
    if (parts.length !== 5) {
        throw new Error(`Invalid cron expression "${expression}", expected 5 fields`);
    }

    return {
        minutes: parseField(parts[0], 0, 59),
        hours: parseField(parts[1], 0, 23),
        daysOfMonth: parseField(parts[2], 1, 31),
        months: parseField(parts[3], 1, 12),
        daysOfWeek: parseField(parts[4], 0, 6),
    };
}

const MAX_CRON_ITERATIONS = 527040;

function nextCronDate(fields: CronFields, from: Date): Date {
    const candidate = new Date(from.getTime());
    candidate.setSeconds(0, 0);
    candidate.setMinutes(candidate.getMinutes() + 1);

    const limit = new Date(from.getTime() + 366 * 24 * 60 * 60 * 1000);
    let iterations = 0;

    while (candidate <= limit) {
        iterations++;
        if (iterations > MAX_CRON_ITERATIONS) {
            throw new Error("No next run found for cron expression (exceeded iteration limit)");
        }
        if (
            fields.months.has(candidate.getMonth() + 1) &&
            fields.daysOfMonth.has(candidate.getDate()) &&
            fields.daysOfWeek.has(candidate.getDay()) &&
            fields.hours.has(candidate.getHours()) &&
            fields.minutes.has(candidate.getMinutes())
        ) {
            return candidate;
        }
        candidate.setMinutes(candidate.getMinutes() + 1);
    }

    throw new Error("No next run found for cron expression");
}

function isCron(expression: string): boolean {
    return expression.trim().split(/\s+/).length === 5;
}

function parseIntervalMs(expression: string): number {
    const match = /^(\d+)(ms|s|m|h)$/.exec(expression.trim());
    if (!match) {
        throw new Error(`Invalid interval "${expression}", expected forms like "500ms", "30s", "5m", "1h"`);
    }

    const value = parseInt(match[1], 10);
    const multipliers: Record<string, number> = { ms: 1, s: 1000, m: 60_000, h: 3_600_000 };
    return value * multipliers[match[2]];
}

const runningTasks = new Set<string>();

async function executeTask(task: ScheduledTask, instance: any): Promise<void> {
    const taskKey = `${task.className}.${task.methodName}`;
    if (runningTasks.has(taskKey)) {
        getFrameworkLogger().warn({ task: taskKey }, "Skipping overlapping scheduled task execution");
        return;
    }
    runningTasks.add(taskKey);
    try {
        await instance[task.methodName]();
    } catch (err) {
        getFrameworkLogger().error({ err, task: taskKey }, "Scheduled task failed");
    } finally {
        runningTasks.delete(taskKey);
    }
}

function scheduleCron(task: ScheduledTask, instance: any): void {
    const fields = parseCron(task.expression);

    const loop = () => {
        const now = getDateInZone(task.zone);
        const delay = Math.max(nextCronDate(fields, now).getTime() - Date.now(), 1000);
        const timer = setTimeout(async () => {
            await executeTask(task, instance);
            loop();
        }, delay);
        timers.push(timer);
    };

    loop();
}

function scheduleInterval(task: ScheduledTask, instance: any): void {
    const intervalMs = parseIntervalMs(task.expression);
    if (task.fixedDelay !== undefined) {
        const loop = () => {
            const timer = setTimeout(async () => {
                await executeTask(task, instance);
                loop();
            }, intervalMs);
            timers.push(timer);
        };
        loop();
    } else {
        const timer = setInterval(() => executeTask(task, instance), intervalMs);
        timers.push(timer);
    }
}

function getDateInZone(zone?: string): Date {
    if (!zone) return new Date();
    try {
        const now = new Date();
        const str = now.toLocaleString("en-US", { timeZone: zone });
        return new Date(str);
    } catch {
        return new Date();
    }
}

export function startScheduledTasks(): void {
    if (timers.length > 0) return;

    tasks.forEach((task) => {
        try {
            const instance = container.resolve(task.target as new (...args: any[]) => any);
            if (isCron(task.expression)) {
                scheduleCron(task, instance);
            } else {
                scheduleInterval(task, instance);
            }
            getFrameworkLogger().info({ task: `${task.className}.${task.methodName}`, expression: task.expression }, "[@Scheduled] registered");
        } catch (err) {
            getFrameworkLogger().error({ err, task: `${task.className}.${task.methodName}` }, "[@Scheduled] failed to register");
        }
    });
}

export function stopScheduledTasks(): void {
    timers.forEach((timer) => clearTimeout(timer));
    timers.length = 0;
}
