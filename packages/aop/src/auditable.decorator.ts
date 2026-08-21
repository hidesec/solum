import { getFrameworkLogger } from "@solumjs/core";
import { Around } from "./aspect.decorator";

export function Auditable(action: string) {
    return Around(async (joinPoint, proceed) => {
        const result = await proceed();

        getFrameworkLogger().info(
            { audit: true, action, class: joinPoint.className, method: joinPoint.methodName },
            `AUDIT: ${action}`
        );

        return result;
    });
}