export interface MessageSource {
    getMessage(code: string, args?: any[], locale?: string): string;
    getMessageWithDefault(code: string, defaultMessage: string, args?: any[], locale?: string): string;
    getMessages(locale: string): Record<string, string>;
}

export interface MessageSourceOptions {
    defaultLocale?: string;
    fallbackLocale?: string;
    basename?: string;
}

const MESSAGE_METADATA = "custom:i18n-messages";

export function I18nMessage(key: string, args?: any[]): PropertyDecorator {
    return function (target: any, propertyKey: string | symbol) {
        const existing: Array<{ propertyKey: string | symbol; key: string; args?: any[] }> =
            Reflect.getOwnMetadata(MESSAGE_METADATA, target.constructor) || [];
        existing.push({ propertyKey, key, args });
        Reflect.defineMetadata(MESSAGE_METADATA, existing, target.constructor);
    };
}

export function getI18nMessages(target: Function): Array<{ propertyKey: string | symbol; key: string; args?: any[] }> {
    return Reflect.getOwnMetadata(MESSAGE_METADATA, target) || [];
}

export class ResourceBundleMessageSource implements MessageSource {
    private messages = new Map<string, Map<string, string>>();
    private defaultLocale: string;
    private fallbackLocale: string;

    constructor(options: MessageSourceOptions = {}) {
        this.defaultLocale = options.defaultLocale || "en";
        this.fallbackLocale = options.fallbackLocale || "en";
    }

    addMessages(locale: string, messages: Record<string, string>): void {
        if (!this.messages.has(locale)) {
            this.messages.set(locale, new Map());
        }
        const map = this.messages.get(locale)!;
        for (const [key, value] of Object.entries(messages)) {
            map.set(key, value);
        }
    }

    getMessage(code: string, args?: any[], locale?: string): string {
        const resolvedLocale = this.resolveLocale(locale);
        const message = this.findMessage(code, resolvedLocale);

        if (message === undefined) {
            return `[MISSING: ${code}]`;
        }

        return this.interpolate(message, args || []);
    }

    getMessageWithDefault(code: string, defaultMessage: string, args?: any[], locale?: string): string {
        const resolvedLocale = this.resolveLocale(locale);
        const message = this.findMessage(code, resolvedLocale);

        if (message === undefined) {
            return this.interpolate(defaultMessage, args || []);
        }

        return this.interpolate(message, args || []);
    }

    getMessages(locale: string): Record<string, string> {
        const resolved = this.resolveLocale(locale);
        const result: Record<string, string> = {};

        const fallback = this.messages.get(this.fallbackLocale);
        if (fallback) {
            for (const [key, value] of fallback) {
                result[key] = value;
            }
        }

        const specific = this.messages.get(resolved);
        if (specific) {
            for (const [key, value] of specific) {
                result[key] = value;
            }
        }

        return result;
    }

    private resolveLocale(locale?: string): string {
        return locale || this.defaultLocale;
    }

    private findMessage(code: string, locale: string): string | undefined {
        const localeMessages = this.messages.get(locale);
        if (localeMessages?.has(code)) {
            return localeMessages.get(code);
        }

        if (locale !== this.fallbackLocale) {
            const fallbackMessages = this.messages.get(this.fallbackLocale);
            if (fallbackMessages?.has(code)) {
                return fallbackMessages.get(code);
            }
        }

        return undefined;
    }

    private interpolate(message: string, args: any[]): string {
        return message.replace(/\{(\d+)\}/g, (match, index) => {
            const i = parseInt(index, 10);
            return i < args.length ? String(args[i]) : match;
        });
    }
}

export function createMessageSource(options?: MessageSourceOptions): ResourceBundleMessageSource {
    return new ResourceBundleMessageSource(options);
}

const DEFAULT_MESSAGES = new Map<string, string>();

export function setDefaultMessage(key: string, value: string): void {
    DEFAULT_MESSAGES.set(key, value);
}

export function getDefaultMessage(key: string): string | undefined {
    return DEFAULT_MESSAGES.get(key);
}
