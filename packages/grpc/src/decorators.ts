const GRPC_SERVICE_KEY = "custom:grpc:service";
const GRPC_METHOD_KEY = "custom:grpc:method";
const GRPC_STREAM_KEY = "custom:grpc:stream";

export type GrpcMethodType = "unary" | "server_streaming" | "client_streaming" | "bidirectional";

export interface GrpcServiceDefinition {
    target: new (...args: any[]) => any;
    serviceName: string;
    methods: GrpcMethodDefinition[];
}

export interface GrpcMethodDefinition {
    methodName: string;
    requestType: string;
    responseType: string;
    type: GrpcMethodType;
    propertyKey: string;
}

export function GrpcService(serviceName: string) {
    return function <T extends new (...args: any[]) => any>(target: T): T {
        const existing = Reflect.getMetadata(GRPC_SERVICE_KEY, target) || [];
        existing.push(serviceName);
        Reflect.defineMetadata(GRPC_SERVICE_KEY, existing, target);
        return target;
    };
}

export function GrpcMethod(methodName: string, options: { requestType?: string; responseType?: string; type?: GrpcMethodType } = {}) {
    return function (target: any, propertyKey: string, _descriptor?: PropertyDescriptor) {
        const existing = Reflect.getMetadata(GRPC_METHOD_KEY, target.constructor) || [];
        existing.push({
            methodName,
            requestType: options.requestType || "any",
            responseType: options.responseType || "any",
            type: options.type || "unary",
            propertyKey,
        });
        Reflect.defineMetadata(GRPC_METHOD_KEY, existing, target.constructor);
    };
}

export function GrpcStream(streamType: "server" | "client" | "bidirectional") {
    return function (target: any, propertyKey: string, _descriptor?: PropertyDescriptor) {
        const existing = Reflect.getMetadata(GRPC_STREAM_KEY, target.constructor) || [];
        existing.push({
            propertyKey,
            streamType,
        });
        Reflect.defineMetadata(GRPC_STREAM_KEY, existing, target.constructor);
    };
}

export function getGrpcServiceDefinition(target: new (...args: any[]) => any): GrpcServiceDefinition | null {
    const serviceNames = Reflect.getMetadata(GRPC_SERVICE_KEY, target);
    if (!serviceNames || serviceNames.length === 0) return null;

    const methods = Reflect.getMetadata(GRPC_METHOD_KEY, target) || [];

    return {
        target,
        serviceName: serviceNames[0],
        methods: methods.map((m: any) => ({
            methodName: m.methodName,
            requestType: m.requestType,
            responseType: m.responseType,
            type: m.type,
            propertyKey: m.propertyKey,
        })),
    };
}

export function getRegisteredGrpcServices(): GrpcServiceDefinition[] {
    const services: GrpcServiceDefinition[] = [];
    return services;
}
