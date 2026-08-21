export interface ConfigPort {
    get(key: string): string | undefined;
    getNumber(key: string): number | undefined;
    getBoolean(key: string): boolean | undefined;
}

function coerceNumber(value: string | undefined): number | undefined {
    if (value === undefined || value === "") return undefined;
    const parsed = Number(value);
    return Number.isNaN(parsed) ? undefined : parsed;
}

function coerceBoolean(value: string | undefined): boolean | undefined {
    if (value === undefined || value === "") return undefined;
    return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

class ProcessEnvConfig implements ConfigPort {
    get(key: string): string | undefined {
        const value = process.env[key];
        return value === undefined || value === "" ? undefined : value;
    }

    getNumber(key: string): number | undefined {
        return coerceNumber(this.get(key));
    }

    getBoolean(key: string): boolean | undefined {
        return coerceBoolean(this.get(key));
    }
}

let configProvider: ConfigPort = new ProcessEnvConfig();

export function setFrameworkConfig(config: ConfigPort): void {
    configProvider = config;
}

export function getFrameworkConfig(): ConfigPort {
    return configProvider;
}
