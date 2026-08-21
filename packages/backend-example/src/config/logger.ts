import fs from "fs";
import path from "path";
import { styleText } from "util";
import { env } from "./env";

type Level = "debug" | "info" | "warn" | "error" | "fatal";

const LEVEL_WEIGHT: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40, fatal: 50 };

const LEVEL_COLOR: Record<Level, "blue" | "green" | "yellow" | "red" | "magenta"> = {
    debug: "blue",
    info: "green",
    warn: "yellow",
    error: "red",
    fatal: "magenta",
};

interface Sink {
    write(level: Level, message: string, payload: Record<string, unknown>): void;
}

class DailyFileSink implements Sink {
    private currentStream?: fs.WriteStream;
    private currentDate = "";

    constructor(private readonly dir: string) {}

    write(level: Level, message: string, payload: Record<string, unknown>): void {
        const stream = this.streamFor(new Date());
        stream.write(`${JSON.stringify({ time: new Date().toISOString(), level, msg: message, ...payload })}\n`);
    }

    private streamFor(date: Date): fs.WriteStream {
        const stamp = date.toISOString().slice(0, 10);
        if (this.currentStream && stamp === this.currentDate) return this.currentStream;

        this.currentStream?.end();
        fs.mkdirSync(this.dir, { recursive: true });
        this.currentDate = stamp;
        this.currentStream = fs.createWriteStream(path.join(this.dir, `app-${stamp}.log`), { flags: "a" });
        return this.currentStream;
    }
}

const BASE_KEYS = new Set(["time", "level", "msg"]);
const PRETTY_SKIP_KEYS = new Set([...BASE_KEYS, "env", "pid"]);

function formatValue(value: unknown): string {
    if (typeof value === "string") return value;
    if (value instanceof Error) return value.message;
    try {
        return JSON.stringify(value) ?? String(value);
    } catch {
        return String(value);
    }
}

function formatPretty(level: Level, message: string, payload: Record<string, unknown>): string {
    const time = new Date();
    const hh = String(time.getHours()).padStart(2, "0");
    const mm = String(time.getMinutes()).padStart(2, "0");
    const ss = String(time.getSeconds()).padStart(2, "0");
    const stamp = `${time.toISOString().slice(0, 10)} ${hh}:${mm}:${ss}`;

    const coloredLevel = styleText(LEVEL_COLOR[level], level.toUpperCase());
    let line = `[${stamp}] ${coloredLevel}:`;
    if (message) line += ` ${styleText("cyan", message)}`;

    const extras: string[] = [];

    for (const [key, value] of Object.entries(payload)) {
        if (PRETTY_SKIP_KEYS.has(key)) continue;
        if (key === "err" && value instanceof Error) {
            extras.push(styleText("red", `${value.name}: ${value.message}`));
            continue;
        }
        extras.push(`${styleText("magenta", key)}=${formatValue(value)}`);
    }

    if (extras.length > 0) {
        line += ` ${styleText("dim", `{${extras.join(", ")}}`)}`;
    }

    for (const [key, value] of Object.entries(payload)) {
        if (key === "err" && value instanceof Error && value.stack) {
            line += `\n${styleText("dim", value.stack.split("\n").slice(1).join("\n"))}`;
        }
    }

    return line;
}

class Logger {
    constructor(
        private readonly minWeight: number,
        private readonly bindings: Record<string, unknown>,
        private readonly sinks: Sink[]
    ) {}

    child(bindings: Record<string, unknown>): Logger {
        return new Logger(this.minWeight, { ...this.bindings, ...bindings }, this.sinks);
    }

    debug(arg: object | string, message?: string): void {
        this.write("debug", arg, message);
    }

    info(arg: object | string, message?: string): void {
        this.write("info", arg, message);
    }

    warn(arg: object | string, message?: string): void {
        this.write("warn", arg, message);
    }

    error(arg: object | string, message?: string): void {
        this.write("error", arg, message);
    }

    fatal(arg: object | string, message?: string): void {
        this.write("fatal", arg, message);
    }

    private write(level: Level, arg: object | string, message?: string): void {
        if (LEVEL_WEIGHT[level] < this.minWeight) return;

        const extra = typeof arg === "object" && arg !== null ? (arg as Record<string, unknown>) : {};
        const text = message ?? (typeof arg === "string" ? arg : "");
        const payload = { ...extra, ...this.bindings };

        for (const sink of this.sinks) {
            sink.write(level, text, payload);
        }
    }
}

const isProduction = env.NODE_ENV === "production";
const minWeight = isProduction ? LEVEL_WEIGHT.info : LEVEL_WEIGHT.debug;
const baseBindings = { env: env.NODE_ENV, pid: process.pid };

const sinks: Sink[] = [
    { write: (level, message, payload) => console.log(formatPretty(level, message, payload)) },
];

if (isProduction) {
    sinks.push(new DailyFileSink("./logs"));
}

export const logger = new Logger(minWeight, baseBindings, sinks);
