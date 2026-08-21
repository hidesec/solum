import "@solumjs/core";
import { container } from "@solumjs/core";
import { getFrameworkLogger } from "@solumjs/core";

const POST_CONSTRUCT_METADATA_KEY = "custom:post-construct";
const PRE_DESTROY_METADATA_KEY = "custom:pre-destroy";

interface DestroyEntry {
    description: string;
    destroy: () => any;
}

const destroyRegistry: DestroyEntry[] = [];
const destroyRegisteredInstances = new WeakSet<object>();

export function PostConstruct() {
    return function (target: any, propertyKey: string, _descriptor?: PropertyDescriptor) {
        const existing: string[] = Reflect.getMetadata(POST_CONSTRUCT_METADATA_KEY, target.constructor) || [];
        existing.push(propertyKey);
        Reflect.defineMetadata(POST_CONSTRUCT_METADATA_KEY, existing, target.constructor);
    };
}

export function PreDestroy() {
    return function (target: any, propertyKey: string, _descriptor?: PropertyDescriptor) {
        const existing: string[] = Reflect.getMetadata(PRE_DESTROY_METADATA_KEY, target.constructor) || [];
        existing.push(propertyKey);
        Reflect.defineMetadata(PRE_DESTROY_METADATA_KEY, existing, target.constructor);
    };
}

export function registerLifecycleHooks(token: string | (new (...args: any[]) => any), target: Function): void {
    const postConstructMethods: string[] = Reflect.getMetadata(POST_CONSTRUCT_METADATA_KEY, target) || [];
    const preDestroyMethods: string[] = Reflect.getMetadata(PRE_DESTROY_METADATA_KEY, target) || [];

    if (postConstructMethods.length === 0 && preDestroyMethods.length === 0) {
        return;
    }

    container.afterResolution(
        token as any,
        (_resolvedToken, result) => {
            const instance = result as Record<string, () => unknown>;
            if (!instance) return;

            for (const methodName of postConstructMethods) {
                instance[methodName]();
            }

            if (preDestroyMethods.length > 0 && !destroyRegisteredInstances.has(instance)) {
                destroyRegisteredInstances.add(instance);
                destroyRegistry.push({
                    description: `${target.name}`,
                    destroy: () => {
                        for (const methodName of preDestroyMethods) {
                            instance[methodName]();
                        }
                    },
                });
            }
        }
    );
}

export function registerDestroyHook(description: string, destroy: () => any): void {
    destroyRegistry.push({ description, destroy });
}

export async function runPreDestroyHooks(): Promise<void> {
    for (const entry of destroyRegistry) {
        try {
            await entry.destroy();
            getFrameworkLogger().info(`[@PreDestroy] ${entry.description} cleaned up`);
        } catch (err) {
            getFrameworkLogger().error({ err }, `[@PreDestroy] ${entry.description} failed to clean up`);
        }
    }
}