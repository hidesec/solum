export class OptimisticLockException extends Error {
    constructor(
        public readonly entityName: string,
        public readonly entityId: unknown,
        public readonly expectedVersion: unknown
    ) {
        super(
            `Optimistic lock failure on "${entityName}" (id=${String(entityId)}): ` +
            `expected version ${String(expectedVersion)} but it was modified or deleted by another transaction.`
        );
        this.name = "OptimisticLockException";
    }
}
