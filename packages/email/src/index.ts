import net from "net";
import tls from "tls";
import crypto from "crypto";
import "@solumjs/core";

export interface EmailOptions {
    to: string | string[];
    cc?: string | string[];
    bcc?: string | string[];
    subject: string;
    text?: string;
    html?: string;
    attachments?: EmailAttachment[];
    from?: string;
    replyTo?: string;
}

export interface EmailAttachment {
    filename: string;
    content: Buffer | string;
    contentType?: string;
    cid?: string;
}

export interface SmtpConfig {
    host: string;
    port?: number;
    secure?: boolean;
    auth?: {
        user: string;
        pass: string;
    };
    from: string;
    tls?: {
        rejectUnauthorized?: boolean;
    };
}

const SMTP_CONFIG_METADATA = "custom:smtp-config";

export function SmtpEmail(config: SmtpConfig): ClassDecorator {
    return function (target: any) {
        Reflect.defineMetadata(SMTP_CONFIG_METADATA, config, target);
    };
}

const MAIL_SEND_METADATA = "custom:mail-send";

export function MailSend(options?: Partial<EmailOptions>): PropertyDecorator {
    return function (target: any, propertyKey: string | symbol) {
        const existing: Array<{ propertyKey: string | symbol; options: Partial<EmailOptions> | undefined }> =
            Reflect.getOwnMetadata(MAIL_SEND_METADATA, target.constructor) || [];
        existing.push({ propertyKey, options });
        Reflect.defineMetadata(MAIL_SEND_METADATA, existing, target.constructor);
    };
}

export function getMailSendDeclarations(target: Function): Array<{ propertyKey: string | symbol; options: Partial<EmailOptions> | undefined }> {
    return Reflect.getOwnMetadata(MAIL_SEND_METADATA, target) || [];
}

function sanitizeHeaderValue(value: string): string {
    return value.replace(/[\r\n]/g, "");
}

function buildMimeMessage(options: EmailOptions, from: string): string {
    const boundary = `----=_Part_${crypto.randomBytes(16).toString("hex")}`;
    const messageId = `<${crypto.randomUUID()}@solumjs>`;
    const date = new Date().toUTCString();

    const headers = [
        `From: ${sanitizeHeaderValue(from)}`,
        `To: ${sanitizeHeaderValue(Array.isArray(options.to) ? options.to.join(", ") : options.to)}`,
        options.cc ? `Cc: ${sanitizeHeaderValue(Array.isArray(options.cc) ? options.cc.join(", ") : options.cc)}` : null,
        options.bcc ? `Bcc: ${sanitizeHeaderValue(Array.isArray(options.bcc) ? options.bcc.join(", ") : options.bcc)}` : null,
        `Subject: ${sanitizeHeaderValue(options.subject)}`,
        `Date: ${date}`,
        `Message-ID: ${messageId}`,
        `MIME-Version: 1.0`,
    ].filter(Boolean);

    if (options.attachments && options.attachments.length > 0) {
        headers.push(`Content-Type: multipart/mixed; boundary="${boundary}"`);
    } else if (options.html) {
        headers.push(`Content-Type: multipart/alternative; boundary="${boundary}"`);
    } else {
        headers.push(`Content-Type: text/plain; charset="utf-8"`);
    }

    let body = headers.join("\r\n") + "\r\n\r\n";

    if (options.attachments && options.attachments.length > 0) {
        if (options.text) {
            body += `--${boundary}\r\nContent-Type: text/plain; charset="utf-8"\r\n\r\n${options.text}\r\n\r\n`;
        }
        if (options.html) {
            body += `--${boundary}\r\nContent-Type: text/html; charset="utf-8"\r\n\r\n${options.html}\r\n\r\n`;
        }
        for (const attachment of options.attachments) {
            const ct = attachment.contentType || "application/octet-stream";
            const content = Buffer.isBuffer(attachment.content)
                ? attachment.content.toString("base64")
                : Buffer.from(attachment.content).toString("base64");
            const cidHeader = attachment.cid ? `Content-ID: <${attachment.cid}>\r\n` : "";
            body += `--${boundary}\r\nContent-Type: ${ct}; name="${attachment.filename}"\r\n${cidHeader}Content-Disposition: attachment; filename="${attachment.filename}"\r\nContent-Transfer-Encoding: base64\r\n\r\n${content}\r\n\r\n`;
        }
        body += `--${boundary}--\r\n`;
    } else if (options.html) {
        if (options.text) {
            body += `--${boundary}\r\nContent-Type: text/plain; charset="utf-8"\r\n\r\n${options.text}\r\n\r\n`;
        }
        body += `--${boundary}\r\nContent-Type: text/html; charset="utf-8"\r\n\r\n${options.html}\r\n\r\n`;
        body += `--${boundary}--\r\n`;
    } else {
        body += options.text || "";
    }

    return body;
}

function base64Encode(str: string): string {
    return Buffer.from(str, "utf8").toString("base64");
}

function parseSmtpResponse(line: string): { code: number; message: string } {
    const match = line.match(/^(\d{3})\s*(.*)/);
    if (!match) return { code: 0, message: line };
    return { code: parseInt(match[1], 10), message: match[2] };
}

async function sendSmtpCommand(
    socket: tls.TLSSocket | net.Socket,
    command: string,
    expectCode?: number
): Promise<{ code: number; message: string }> {
    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error(`SMTP timeout on: ${command.split("\r\n")[0]}`)), 30000);

        const responseHandler = (data: Buffer) => {
            const lines = data.toString().split("\r\n").filter((l) => l.length > 0);
            const lastLine = lines[lines.length - 1];
            const response = parseSmtpResponse(lastLine);

            clearTimeout(timeout);
            socket.removeListener("data", responseHandler);

            if (expectCode && response.code !== expectCode) {
                reject(new Error(`SMTP error: ${response.code} ${response.message}`));
            } else {
                resolve(response);
            }
        };

        socket.on("data", responseHandler);
        socket.write(command);
    });
}

async function sendMailDirect(config: SmtpConfig, options: EmailOptions): Promise<void> {
    const host = config.host;
    const port = config.port || (config.secure ? 465 : 587);
    const from = options.from || config.from;

    const mimeMessage = buildMimeMessage(options, from);

    return new Promise((resolve, reject) => {
        const connect = () => {
            const socket = net.createConnection({ host, port }, async () => {
                let tlsSocket: tls.TLSSocket | net.Socket = socket;

                try {
                    const greeting = await new Promise<{ code: number; message: string }>((res, rej) => {
                        const timeout = setTimeout(() => rej(new Error("SMTP connection timeout")), 10000);
                        socket.once("data", (data) => {
                            clearTimeout(timeout);
                            res(parseSmtpResponse(data.toString().split("\r\n")[0]));
                        });
                    });

                    if (greeting.code !== 220) {
                        reject(new Error(`SMTP greeting error: ${greeting.code} ${greeting.message}`));
                        socket.destroy();
                        return;
                    }

                    await sendSmtpCommand(tlsSocket, `EHLO solumjs.local\r\n`, 250);

                    if (config.auth) {
                        await sendSmtpCommand(tlsSocket, `STARTTLS\r\n`, 220);
                        const rejectTls = config.tls?.rejectUnauthorized ?? true;
                        if (!rejectTls) {
                            console.warn("[SolumJS Email] WARNING: TLS certificate verification is disabled (rejectUnauthorized: false). This is insecure and vulnerable to MITM attacks. Only use in development.");
                        }
                        const tlsOpts: tls.ConnectionOptions = {
                            host,
                            rejectUnauthorized: rejectTls,
                        };
                        tlsSocket = tls.connect({ ...tlsOpts, socket } as any);
                        await new Promise<void>((res) => (tlsSocket as tls.TLSSocket).on("secure", res));
                        await sendSmtpCommand(tlsSocket, `EHLO solumjs.local\r\n`, 250);
                        await sendSmtpCommand(
                            tlsSocket,
                            `AUTH PLAIN\r\n${base64Encode("\0" + config.auth.user + "\0" + config.auth.pass)}\r\n`,
                            235
                        );
                    }

                    await sendSmtpCommand(tlsSocket, `MAIL FROM:<${from}>\r\n`, 250);

                    const recipients = [
                        ...(Array.isArray(options.to) ? options.to : [options.to]),
                        ...(options.cc ? (Array.isArray(options.cc) ? options.cc : [options.cc]) : []),
                        ...(options.bcc ? (Array.isArray(options.bcc) ? options.bcc : [options.bcc]) : []),
                    ];
                    for (const recipient of recipients) {
                        await sendSmtpCommand(tlsSocket, `RCPT TO:<${recipient}>\r\n`, 250);
                    }

                    await sendSmtpCommand(tlsSocket, `DATA\r\n`, 354);

                    const dataLines = mimeMessage.split("\r\n").join(".\r\n");
                    await sendSmtpCommand(tlsSocket, `${dataLines}\r\n.\r\n`, 250);

                    await sendSmtpCommand(tlsSocket, `QUIT\r\n`);

                    tlsSocket.destroy();
                    resolve();
                } catch (err) {
                    tlsSocket.destroy();
                    reject(err);
                }
            });

            socket.on("error", reject);
        };

        if (config.secure && config.port === 465) {
            const tlsSocket = tls.connect({ host, port, rejectUnauthorized: config.tls?.rejectUnauthorized ?? true }, async () => {
                try {
                    await sendSmtpCommand(tlsSocket, `EHLO solumjs.local\r\n`, 250);
                    if (config.auth) {
                        await sendSmtpCommand(
                            tlsSocket,
                            `AUTH PLAIN\r\n${base64Encode("\0" + config.auth.user + "\0" + config.auth.pass)}\r\n`,
                            235
                        );
                    }
                    await sendSmtpCommand(tlsSocket, `MAIL FROM:<${from}>\r\n`, 250);
                    const recipients = [
                        ...(Array.isArray(options.to) ? options.to : [options.to]),
                        ...(options.cc ? (Array.isArray(options.cc) ? options.cc : [options.cc]) : []),
                        ...(options.bcc ? (Array.isArray(options.bcc) ? options.bcc : [options.bcc]) : []),
                    ];
                    for (const r of recipients) {
                        await sendSmtpCommand(tlsSocket, `RCPT TO:<${r}>\r\n`, 250);
                    }
                    await sendSmtpCommand(tlsSocket, `DATA\r\n`, 354);
                    const dataLines = mimeMessage.split("\r\n").join(".\r\n");
                    await sendSmtpCommand(tlsSocket, `${dataLines}\r\n.\r\n`, 250);
                    await sendSmtpCommand(tlsSocket, `QUIT\r\n`);
                    tlsSocket.destroy();
                    resolve();
                } catch (err) {
                    tlsSocket.destroy();
                    reject(err);
                }
            });
            tlsSocket.on("error", reject);
        } else {
            connect();
        }
    });
}

const emails: EmailOptions[] = [];
let testMode = false;
let lastSentEmail: EmailOptions | null = null;

export function enableTestMode(): void {
    testMode = true;
    emails.length = 0;
}

export function disableTestMode(): void {
    testMode = false;
}

export function getSentEmails(): EmailOptions[] {
    return [...emails];
}

export function getLastSentEmail(): EmailOptions | null {
    return lastSentEmail;
}

export function clearSentEmails(): void {
    emails.length = 0;
    lastSentEmail = null;
}

export class MailService {
    private config: SmtpConfig;

    constructor(config: SmtpConfig) {
        this.config = config;
    }

    async send(options: EmailOptions): Promise<void> {
        if (testMode) {
            emails.push(options);
            lastSentEmail = options;
            return;
        }
        await sendMailDirect(this.config, options);
    }

    getConfig(): SmtpConfig {
        const config = { ...this.config };
        if (config.auth?.pass) {
            config.auth = { ...config.auth, pass: "********" };
        }
        return config;
    }
}

export interface EmailTemplate {
    name: string;
    subject: string;
    html: string;
    text?: string;
}

export class TemplateEngine {
    private templates = new Map<string, EmailTemplate>();

    register(template: EmailTemplate): void {
        this.templates.set(template.name, template);
    }

    render(templateName: string, data: Record<string, unknown>): { subject: string; html: string; text?: string } {
        const template = this.templates.get(templateName);
        if (!template) {
            throw new Error(`Email template "${templateName}" not found`);
        }

        return {
            subject: this.interpolate(template.subject, data),
            html: this.interpolate(template.html, data),
            text: template.text ? this.interpolate(template.text, data) : undefined,
        };
    }

    private interpolate(template: string, data: Record<string, unknown>): string {
        return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
            const value = data[key];
            if (value === undefined) return match;
            const str = String(value);
            return str.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#x27;" }[c] ?? c));
        });
    }

    getTemplateNames(): string[] {
        return Array.from(this.templates.keys());
    }
}

export function createTemplateEngine(): TemplateEngine {
    return new TemplateEngine();
}
