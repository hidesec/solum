# @solumjs/email

SMTP email sending with template engine and test mode.

## Install

```bash
npm install @solumjs/email
```

## SMTP Configuration

```typescript
import { SmtpEmail, MailService, TemplateEngine } from "@solumjs/email";
import { Bean } from "@solumjs/core";

@SmtpEmail({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    auth: { user: "you@gmail.com", pass: "app-password" },
    from: "My App <noreply@myapp.com>",
})
export class AppEmailClient {}
```

## Sending Emails

```typescript
import { MailService } from "@solumjs/email";

const mailService = new MailService({
    host: "smtp.gmail.com",
    port: 587,
    from: "My App <noreply@myapp.com>",
});

// Simple email
await mailService.send({
    to: "user@example.com",
    subject: "Welcome!",
    html: "<h1>Hello!</h1>",
});

// With text fallback
await mailService.send({
    to: "user@example.com",
    subject: "Welcome!",
    html: "<h1>Hello!</h1>",
    text: "Hello!",
});

// With attachments
await mailService.send({
    to: "user@example.com",
    subject: "Your Report",
    html: "<p>Please find attached your report.</p>",
    attachments: [
        { filename: "report.pdf", content: pdfBuffer, contentType: "application/pdf" },
    ],
});

// Multiple recipients
await mailService.send({
    to: ["user1@example.com", "user2@example.com"],
    cc: "manager@example.com",
    bcc: "archive@example.com",
    subject: "Team Update",
    html: "<p>Update</p>",
});
```

## EmailOptions Interface

```typescript
interface EmailOptions {
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

interface EmailAttachment {
    filename: string;
    content: Buffer | string;
    contentType?: string;
    cid?: string; // Content-ID for inline images
}
```

## Template Engine

```typescript
import { TemplateEngine, createTemplateEngine } from "@solumjs/email";

const engine = createTemplateEngine();

// Register templates
engine.register({
    name: "welcome",
    subject: "Welcome to {{platform}}!",
    html: "<h1>Hello {{name}}!</h1><p>Welcome to {{platform}}.</p>",
    text: "Hello {{name}}! Welcome to {{platform}}.",
});

// Render template
const rendered = engine.render("welcome", { name: "John", platform: "SolumJS" });
// { subject: "Welcome to SolumJS!", html: "...", text: "..." }

// List template names
const names = engine.getTemplateNames(); // ["welcome"]
```

## Test Mode

```typescript
import { enableTestMode, disableTestMode, getSentEmails, getLastSentEmail, clearSentEmails } from "@solumjs/email";

// Enable test mode (no actual emails sent)
enableTestMode();

// Send email (intercepted)
await mailService.send({ to: "test@example.com", subject: "Test", html: "Hello" });

// Retrieve sent emails
const emails = getSentEmails();
expect(emails.length).toBe(1);
expect(emails[0].to).toBe("test@example.com");

// Get last sent email
const last = getLastSentEmail();

// Clear
clearSentEmails();

// Disable test mode
disableTestMode();
```

## Security Features

- **Header sanitization** — CRLF injection prevention
- **Address sanitization** — Angle bracket and newline stripping
- **Body size limit** — 10MB maximum email size
- **STARTTLS** — Upgrade to TLS for authentication
- **Timing-safe comparison** — For password verification
- **HTML escaping** — Template interpolation auto-escapes special characters

## License

MIT
