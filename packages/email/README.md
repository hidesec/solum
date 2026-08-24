# @solumjs/email

Email sending module for SolumJS.

## Installation

```bash
npm install @solumjs/email
```

## Features

- SMTP transport
- HTML and plain text emails
- Template engine
- Attachment support
- Test mode (no-op)

## Usage

```typescript
import { MailService, SendEmailDto } from "@solumjs/email";

const mailService = new MailService({
    host: "smtp.example.com",
    port: 587,
    auth: { user: "user", pass: "pass" },
});

await mailService.send({
    to: "user@example.com",
    subject: "Welcome!",
    html: "<h1>Hello!</h1>",
});
```
