import { getFrameworkLogger } from "@solumjs/core";
import { Around } from "./aspect.decorator";

export function LogExecution() {
    return Around(async (joinPoint, proceed) => {
        const label = `${joinPoint.className}.${joinPoint.methodName}`;
        const start = process.hrtime.bigint();

        getFrameworkLogger().info({ class: joinPoint.className, method: joinPoint.methodName }, `-> Entering ${label}`);

        try {
            const result = await proceed();
            const durationMs = Number(process.hrtime.bigint() - start) / 1e6;

            getFrameworkLogger().info(
                { class: joinPoint.className, method: joinPoint.methodName, durationMs },
                `<- Exiting ${label} (${durationMs.toFixed(1)}ms)`
            );

            return result;
        } catch (err) {
            const durationMs = Number(process.hrtime.bigint() - start) / 1e6;

            getFrameworkLogger().error(
                { class: joinPoint.className, method: joinPoint.methodName, durationMs },
                `x Error in ${label} (${durationMs.toFixed(1)}ms)`
            );

            throw err;
        }
    });
}