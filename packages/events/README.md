# @solumjs/events

Event-driven architecture module for SolumJS.

## Installation

```bash
npm install @solumjs/events
```

## Features

- Event emitter
- Event listeners with decorators
- Async event handling
- Event ordering

## Usage

```typescript
import { OnEvent, EventEmitter } from "@solumjs/events";

class UserCreatedEvent {
    constructor(public userId: string) {}
}

class WelcomeEmailListener {
    @OnEvent(UserCreatedEvent)
    async handle(event: UserCreatedEvent) {
        await sendWelcomeEmail(event.userId);
    }
}

// Emit events
const emitter = new EventEmitter();
emitter.emit(new UserCreatedEvent("123"));
```
