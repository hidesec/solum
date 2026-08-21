export interface LoggerPort {
    info(msg: string): void;
    info(obj: object, msg?: string): void;
    warn(msg: string): void;
    warn(obj: object, msg?: string): void;
    error(msg: string): void;
    error(obj: object, msg?: string): void;
    debug(msg: string): void;
    debug(obj: object, msg?: string): void;
    child(bindings: Record<string, unknown>): LoggerPort;
}

type LogArgs = [msg: string] | [obj: object, msg?: string];

function formatArgs(args: LogArgs): { obj: object; msg: string } {
    if (typeof args[0] === "string") {
        return { obj: {}, msg: args[0] };
    }
    return { obj: args[0], msg: (args[1] as string) ?? "" };
}

class ConsoleLogger implements LoggerPort {
    constructor(private readonly bindings: Record<string, unknown> = {}) {}

    private emit(level: "info" | "warn" | "error" | "debug", args: LogArgs): void {
        const { obj, msg } = formatArgs(args);
        const merged = Object.keys(this.bindings).length > 0 ? { ...this.bindings, ...obj } : obj;
        const line = msg || JSON.stringify(merged);
        const target = level === "debug" ? console.log : console[level];
        if (Object.keys(merged).length > 0 && msg) {
            target(line, JSON.stringify(merged));
        } else {
            target(line);
        }
    }

    info(...args: LogArgs): void {
        this.emit("info", args);
    }

    warn(...args: LogArgs): void {
        this.emit("warn", args);
    }

    error(...args: LogArgs): void {
        this.emit("error", args);
    }

    debug(...args: LogArgs): void {
        this.emit("debug", args);
    }

    child(bindings: Record<string, unknown>): LoggerPort {
        return new ConsoleLogger({ ...this.bindings, ...bindings });
    }
}

let currentLogger: LoggerPort = new ConsoleLogger();

export function setFrameworkLogger(logger: LoggerPort): void {
    currentLogger = logger;
}

export function getFrameworkLogger(): LoggerPort {
    return currentLogger;
}
