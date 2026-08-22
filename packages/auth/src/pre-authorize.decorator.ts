import "@solumjs/http";
import { UseGuards } from "@solumjs/http";
import { ExpressionGuard } from "./pre-authorize.guard";

const PRE_AUTHORIZE_KEY = "custom:pre-authorize";

export function PreAuthorize(expression: string): ClassDecorator & MethodDecorator {
    return function (target: any, propertyKey?: string | symbol, _descriptor?: PropertyDescriptor) {
        if (propertyKey === undefined) {
            Reflect.defineMetadata(PRE_AUTHORIZE_KEY, expression, target);
            UseGuards(ExpressionGuard)(target as Function);
            return target;
        }

        const destination = target.constructor ?? target;
        Reflect.defineMetadata(PRE_AUTHORIZE_KEY, expression, destination, propertyKey as string);
        UseGuards(ExpressionGuard)(target as Function, propertyKey, _descriptor as PropertyDescriptor);
    };
}
