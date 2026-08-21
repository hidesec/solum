export interface JoinPoint {
    target: any;
    className: string;
    methodName: string;
    args: any[];
}

export type MethodInterceptor = (
    joinPoint: JoinPoint,
    proceed: () => Promise<any>
) => Promise<any>;

export function Around(interceptor: MethodInterceptor) {
    return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
        const originalMethod = descriptor.value;
        const fallbackClassName = target?.constructor?.name ?? target?.name ?? "UnknownClass";

        descriptor.value = function (this: any, ...args: any[]) {
            const className = this?.constructor?.name ?? fallbackClassName;

            const joinPoint: JoinPoint = {
                target: this,
                className,
                methodName: propertyKey,
                args,
            };
            const proceed = () => originalMethod.apply(this, args);

            return interceptor(joinPoint, proceed);
        };

        return descriptor;
    };
}