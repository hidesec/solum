import "@solumjs/core";
import { container } from "@solumjs/core";
import { registerDestroyHook, registerLifecycleHooks } from "./lifecycle.decorator";

const BEAN_METADATA_KEY = "custom:bean-methods";

interface BeanMethodOptions {
    destroyMethod?: string;
}

interface BeanDefinition {
    token: string;
    methodName: string;
    destroyMethod?: string;
}

export function Bean(token?: string, options?: BeanMethodOptions) {
    return function (target: any, propertyKey?: string, _descriptor?: PropertyDescriptor) {
        if (propertyKey === undefined) {
            const registrationToken = token ?? target.name;
            container.register(registrationToken, { useClass: target });
            registerLifecycleHooks(registrationToken, target);
            return target
        }
        
        const existingBeans: BeanDefinition[] = Reflect.getMetadata(BEAN_METADATA_KEY, target.constructor) || [];

        existingBeans.push({
            token: token ?? propertyKey,
            methodName: propertyKey,
            destroyMethod: options?.destroyMethod,
        });

        Reflect.defineMetadata(BEAN_METADATA_KEY, existingBeans, target.constructor);
    }
}

export function Configuration() {
    return function <T extends new (...args: any[]) => any>(target: T): T {
        const instance = new target();

        const beans: BeanDefinition[] = Reflect.getMetadata(BEAN_METADATA_KEY, target) || [];

        if (beans.length === 0) {
            console.warn(`[@Configuration] "${target.name}" has no @Bean methods defined.`);
        }

        beans.forEach(({ token, methodName,destroyMethod }) => {
            const beanInstance = (instance as any)[methodName]();
            container.register(token, { useValue: beanInstance });

            if (destroyMethod) {
                registerDestroyHook(token, () => beanInstance[destroyMethod]());
            }
        });

        return target;
    }
}

