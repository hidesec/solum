export type LogLevel = "debug" | "info" | "warn" | "error" | "fatal";

export interface LoggerOptions {
    level?: LogLevel;
    timestamp?: boolean;
    serviceName?: string;
    json?: boolean;
}

const LOG_LEVELS: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
    fatal: 4,
};

function formatTimestamp(): string {
    return new Date().toISOString();
}

function formatJsonEntry(level: LogLevel, message: string, context: string | undefined, extra: Record<string, unknown> | undefined): string {
    const entry: Record<string, unknown> = {
        level,
        time: formatTimestamp(),
        msg: message,
    };
    if (context) entry.context = context;
    if (extra) Object.assign(entry, extra);
    return JSON.stringify(entry);
}

function formatPrettyEntry(level: LogLevel, message: string, context: string | undefined, extra: Record<string, unknown> | undefined): string {
    const ts = formatTimestamp();
    const ctx = context ? `[${context}]` : "";
    const base = `${ts} ${level.toUpperCase().padEnd(5)} ${ctx} ${message}`;
    if (extra && Object.keys(extra).length > 0) {
        return `${base} ${JSON.stringify(extra)}`;
    }
    return base;
}

export class Logger {
    private readonly level: LogLevel;
    private readonly serviceName?: string;
    private readonly json: boolean;
    private readonly timestamp: boolean;

    constructor(
        private readonly context: string,
        options: LoggerOptions = {}
    ) {
        this.level = options.level ?? (process.env.LOG_LEVEL as LogLevel) ?? "info";
        this.serviceName = options.serviceName;
        this.json = options.json ?? process.env.LOG_FORMAT === "json";
        this.timestamp = options.timestamp ?? true;
    }

    private shouldLog(level: LogLevel): boolean {
        return LOG_LEVELS[level] >= LOG_LEVELS[this.level];
    }

    private log(level: LogLevel, message: string, extra?: Record<string, unknown>): void {
        if (!this.shouldLog(level)) return;

        const ctx = this.serviceName ? `${this.serviceName}:${this.context}` : this.context;

        if (this.json) {
            const formatted = formatJsonEntry(level, message, ctx, extra);
            if (level === "error" || level === "fatal") {
                console.error(formatted);
            } else if (level === "warn") {
                console.warn(formatted);
            } else {
                console.log(formatted);
            }
        } else {
            const formatted = formatPrettyEntry(level, message, ctx, extra);
            if (level === "error" || level === "fatal") {
                console.error(formatted);
            } else if (level === "warn") {
                console.warn(formatted);
            } else {
                console.log(formatted);
            }
        }
    }

    debug(message: string, extra?: Record<string, unknown>): void {
        this.log("debug", message, extra);
    }

    info(message: string, extra?: Record<string, unknown>): void {
        this.log("info", message, extra);
    }

    warn(message: string, extra?: Record<string, unknown>): void {
        this.log("warn", message, extra);
    }

    error(message: string, extra?: Record<string, unknown>): void {
        this.log("error", message, extra);
    }

    fatal(message: string, extra?: Record<string, unknown>): void {
        this.log("fatal", message, extra);
    }

    child(context: string): Logger {
        return new Logger(`${this.context}:${context}`, {
            level: this.level,
            serviceName: this.serviceName,
            json: this.json,
            timestamp: this.timestamp,
        });
    }

    withContext(context: string): Logger {
        return this.child(context);
    }
}

let globalLogger: Logger | undefined;

export function createLogger(context: string, options?: LoggerOptions): Logger {
    return new Logger(context, options);
}

export function setGlobalLogger(logger: Logger): void {
    globalLogger = logger;
}

export function getLogger(context?: string): Logger {
    if (!globalLogger) {
        globalLogger = new Logger("app");
    }
    if (context) {
        return globalLogger.child(context);
    }
    return globalLogger;
}