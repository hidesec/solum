import { getFrameworkLogger } from "@solumjs/core";
import { getActiveTransactionClient, getDatabaseDriver, runInTransactionContext } from "@solumjs/orm";

export function Transactional() {
    return function (
        _target: any,
        propertyKey: string,
        descriptor: PropertyDescriptor
    ) {
        const originalMethod = descriptor.value;

        descriptor.value = async function (this: any, ...args: any[]) {
            const existingClient = getActiveTransactionClient();

            if (existingClient) {
                return originalMethod.apply(this, args);
            }

            const driver = getDatabaseDriver();

            try {
                return await driver.transaction((tx) =>
                    runInTransactionContext(tx, () => originalMethod.apply(this, args))
                );
            } catch (err) {
                getFrameworkLogger().warn({ method: propertyKey }, "Transactional rolled back");
                throw err;
            }
        };

        return descriptor;
    };
}
