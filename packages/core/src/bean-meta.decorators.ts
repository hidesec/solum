import "./reflect-metadata";
import { BeanScope } from "./container";
import { getFrameworkConfig } from "./framework-config";

const SCOPE_METADATA_KEY = "custom:bean-scope";
const LAZY_METADATA_KEY = "custom:bean-lazy";
const PRIMARY_METADATA_KEY = "custom:bean-primary";
const ORDER_METADATA_KEY = "custom:bean-order";
const QUALIFIER_METADATA_KEY = "custom:bean-name";
const CONDITIONAL_PROPERTY_METADATA_KEY = "custom:conditional-property";

export interface ConditionalOnPropertyOptions {
    property: string;
    havingValue?: string;
    matchIfMissing?: boolean;
}

export function Scope(scope: BeanScope): ClassDecorator {
    return (target) => {
        Reflect.defineMetadata(SCOPE_METADATA_KEY, scope, target as object);
    };
}

export function Lazy(): ClassDecorator {
    return (target) => {
        Reflect.defineMetadata(LAZY_METADATA_KEY, true, target as object);
    };
}

export function Primary(): ClassDecorator {
    return (target) => {
        Reflect.defineMetadata(PRIMARY_METADATA_KEY, true, target as object);
    };
}

export function Order(order: number): ClassDecorator {
    return (target) => {
        Reflect.defineMetadata(ORDER_METADATA_KEY, order, target as object);
    };
}

export function Qualifier(name: string): ClassDecorator {
    return (target) => {
        Reflect.defineMetadata(QUALIFIER_METADATA_KEY, name, target as object);
    };
}

export function ConditionalOnProperty(options: ConditionalOnPropertyOptions): ClassDecorator {
    return (target) => {
        Reflect.defineMetadata(CONDITIONAL_PROPERTY_METADATA_KEY, options, target as object);
    };
}

function truthy(raw: string): boolean {
    return ["1", "true", "yes", "on"].includes(raw.toLowerCase());
}

export function evaluateConditionalProperty(
    options: ConditionalOnPropertyOptions
): boolean {
    const raw = getFrameworkConfig().get(options.property);
    if (raw === undefined || raw === "") {
        return options.matchIfMissing ?? false;
    }
    if (options.havingValue !== undefined) {
        return raw === options.havingValue;
    }
    return truthy(raw);
}

export function getBeanScope(target: object): BeanScope | undefined {
    return Reflect.getMetadata(SCOPE_METADATA_KEY, target) as BeanScope | undefined;
}

export function isLazyBean(target: object): boolean {
    return Reflect.getMetadata(LAZY_METADATA_KEY, target) === true;
}

export function isPrimaryBean(target: object): boolean {
    return Reflect.getMetadata(PRIMARY_METADATA_KEY, target) === true;
}

export function getBeanOrder(target: object): number | undefined {
    return Reflect.getMetadata(ORDER_METADATA_KEY, target) as number | undefined;
}

export function getBeanName(target: object): string | undefined {
    return Reflect.getMetadata(QUALIFIER_METADATA_KEY, target) as string | undefined;
}

export function buildConditionalPredicate(target: Function): (() => boolean) | undefined {
    const conditional = Reflect.getMetadata(
        CONDITIONAL_PROPERTY_METADATA_KEY,
        target
    ) as ConditionalOnPropertyOptions | undefined;

    if (!conditional) return undefined;
    return () => evaluateConditionalProperty(conditional);
}
