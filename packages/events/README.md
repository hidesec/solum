# @solumjs/events

Event-driven architecture with publish/subscribe pattern.

## Install

```bash
npm install @solumjs/events
```

## EventBus

```typescript
import { EventBus } from "@solumjs/events";
import { Bean, inject } from "@solumjs/core";

@Bean("IUserService")
export class UserService {
    constructor(@inject("IEventBus") private eventBus: EventBus) {}

    async createUser(dto: CreateUserDto): Promise<User> {
        const user = await this.userRepo.save(new User(dto));
        this.eventBus.publish("USER_CREATED", { userId: user.id, email: user.email });
        return user;
    }
}
```

## @EventListener

```typescript
import { EventListener } from "@solumjs/events";

export class UserCreatedListener {

    @EventListener("USER_CREATED")
    async handleUserCreated(payload: { userId: string; email: string }) {
        console.log(`User created: ${payload.email}`);
    }
}
```

## @TransactionalEventListener

Runs after the parent transaction commits. Only fires if the transaction succeeds.

```typescript
import { TransactionalEventListener } from "@solumjs/events";

export class UserAuditListener {

    @TransactionalEventListener("USER_CREATED")
    async handleAfterCommit(payload: { userId: string }) {
        await this.auditRepo.log("USER_CREATED", payload);
    }
}
```

## @Async

Runs the listener asynchronously (fire-and-forget). Does not block the publisher.

```typescript
import { EventListener, Async } from "@solumjs/events";

export class UserWelcomeListener {

    @EventListener("USER_CREATED")
    @Async()
    async sendWelcomeEmail(payload: { userId: string; email: string }) {
        await this.emailService.sendWelcome(payload.email);
    }
}
```

## DomainEvent Interface

```typescript
import { DomainEvent } from "@solumjs/events";

interface DomainEvent<T = unknown> {
    type: string;
    payload: T;
    occurredAt: string;
}
```

## License

MIT
