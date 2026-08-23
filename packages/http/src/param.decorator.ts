import "@solumjs/core";

export enum ParamSource {
    BODY = "body",
    PARAM = "param",
    QUERY = "query",
    HEADER = "header",
    COOKIE = "cookie",
    CURRENT_USER = "currentUser",
    REQ = "req",
    RES = "res",
    NEXT = "next",
}

export interface ValidOptions {
    whitelist?: boolean;
    forbidNonWhitelisted?: boolean;
}

export interface ParamMetadata {
    index: number;
    source: ParamSource;
    name?: string;
    validate?: boolean;
    validateOptions?: ValidOptions;
}

const PARAMS_METADATA_KEY = "custom:route-params";

function addOrPatchParam(target: any, propertyKey: string, index: number, patch: Partial<ParamMetadata>): void {
    const existing: ParamMetadata[] = Reflect.getMetadata(PARAMS_METADATA_KEY, target, propertyKey) || [];

    const current = existing.find((p) => p.index === index);
    if (current) {
        Object.assign(current, patch);
    } else {
        existing.push({ index, source: ParamSource.BODY, ...patch });
    }

    Reflect.defineMetadata(PARAMS_METADATA_KEY, existing, target, propertyKey);
}

export function Body(): ParameterDecorator {
    return (target, propertyKey, index) => {
        addOrPatchParam(target, propertyKey as string, index, { source: ParamSource.BODY });
    };
}

export function Param(name?: string): ParameterDecorator {
    return (target, propertyKey, index) => {
        addOrPatchParam(target, propertyKey as string, index, { source: ParamSource.PARAM, name });
    };
}

export function Query(name?: string): ParameterDecorator {
    return (target, propertyKey, index) => {
        addOrPatchParam(target, propertyKey as string, index, { source: ParamSource.QUERY, name });
    };
}

export function Header(name?: string): ParameterDecorator {
    return (target, propertyKey, index) => {
        addOrPatchParam(target, propertyKey as string, index, { source: ParamSource.HEADER, name });
    };
}

export function CookieValue(name?: string): ParameterDecorator {
    return (target, propertyKey, index) => {
        addOrPatchParam(target, propertyKey as string, index, { source: ParamSource.COOKIE, name });
    };
}

export function CurrentUser(): ParameterDecorator {
    return (target, propertyKey, index) => {
        addOrPatchParam(target, propertyKey as string, index, { source: ParamSource.CURRENT_USER });
    };
}

export function Req(): ParameterDecorator {
    return (target, propertyKey, index) => {
        addOrPatchParam(target, propertyKey as string, index, { source: ParamSource.REQ });
    };
}

export function Res(): ParameterDecorator {
    return (target, propertyKey, index) => {
        addOrPatchParam(target, propertyKey as string, index, { source: ParamSource.RES });
    };
}

export function Next(): ParameterDecorator {
    return (target, propertyKey, index) => {
        addOrPatchParam(target, propertyKey as string, index, { source: ParamSource.NEXT });
    };
}

export function Valid(options?: ValidOptions): ParameterDecorator {
    return (target, propertyKey, index) => {
        addOrPatchParam(target, propertyKey as string, index, { validate: true, validateOptions: options });
    };
}

export function getParamsMetadata(target: Function, propertyKey: string): ParamMetadata[] {
    return (Reflect.getMetadata(PARAMS_METADATA_KEY, target.prototype, propertyKey) || []) as ParamMetadata[];
}

export function getParamType(target: Function, propertyKey: string, index: number): any {
    const paramTypes: any[] = Reflect.getMetadata("design:paramtypes", target.prototype, propertyKey) || [];
    return paramTypes[index];
}
