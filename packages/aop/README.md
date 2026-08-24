# @solumjs/aop

Aspect-Oriented Programming with pointcut expressions and advice decorators.

## Install

```bash
npm install @solumjs/aop
```

## @Aspect

```typescript
import { Aspect, Around, Before, After, AfterReturning, AfterThrowing } from "@solumjs/aop";
import { Bean } from "@solumjs/core";

@Aspect()
@Bean("PerformanceAspect")
export class PerformanceAspect {

    @Around("execution(* com.myapp.service.*.*(..))")
    async measurePerformance(joinPoint: JoinPoint) {
        const start = Date.now();
        const result = await joinPoint.proceed();
        console.log(`${joinPoint.target.constructor.name}.${joinPoint.methodName} took ${Date.now() - start}ms`);
        return result;
    }
}
```

## Advice Types

### @Around

Wraps the method execution. Must call `proceed()`.

```typescript
@Around(async (joinPoint, proceed) => {
    console.log(`Before ${joinPoint.methodName}`);
    const result = await proceed();
    console.log(`After ${joinPoint.methodName}`);
    return result;
})
```

### @Before

Runs before method execution.

```typescript
@Before(async (joinPoint) => {
    console.log(`Calling ${joinPoint.methodName} with args:`, joinPoint.args);
})
```

### @After

Runs after method execution (always, even on error).

```typescript
@After(async (joinPoint) => {
    console.log(`Finished ${joinPoint.methodName}`);
})
```

### @AfterReturning

Runs after successful execution. Can modify the return value.

```typescript
@AfterReturning(async (joinPoint, result) => {
    console.log(`${joinPoint.methodName} returned:`, result);
    return result; // or return modified value
})
```

### @AfterThrowing

Runs after exception. Can recover from error.

```typescript
@AfterThrowing(async (joinPoint, error) => {
    console.error(`${joinPoint.methodName} threw:`, error);
    // Return a value to recover from the error
})
```

## JoinPoint Interface

```typescript
interface JoinPoint {
    target: any;           // The class instance
    className: string;     // Class name
    methodName: string;    // Method name
    args: any[];           // Method arguments
}
```

## @LogExecution

Built-in logging aspect.

```typescript
import { LogExecution } from "@solumjs/aop";

@Bean("IUserService")
export class UserService {

    @LogExecution()
    async createUser(dto: CreateUserDto): Promise<User> {
        return this.userRepo.save(new User(dto));
    }
}
```

## @Auditable

Built-in audit trail aspect.

```typescript
import { Auditable } from "@solumjs/aop";

@Bean("IDocumentService")
export class DocumentService {

    @Auditable({ action: "UPDATE", resource: "Document" })
    async updateDocument(id: string, dto: UpdateDocumentDto): Promise<Document> {
        return this.documentRepo.update(id, dto);
    }
}
```

## Named Pointcuts

```typescript
import { Pointcut, resolvePointcut } from "@solumjs/aop";

// Define named pointcut
@Bean("IMyAspect")
export class MyAspect {
    @Pointcut("serviceMethods", "execution(* com.myapp.service.*.*(..))")
    serviceMethods() {}
}
```

## License

MIT
