import { SolumjsRequest } from "@solumjs/http";
import { getFrameworkLogger } from "@solumjs/core";
import { ControllerAdvice, ExceptionHandler } from "@solumjs/decorators";
import {
    BadRequestException,
    ForbiddenException,
    HttpException,
    InvalidQueryParameterException,
    NotFoundException,
    ServiceUnavailableException,
    UnauthorizedException,
} from "@solumjs/core";

@ControllerAdvice()
export class GlobalExceptionAdvice {
    @ExceptionHandler(NotFoundException)
    handleNotFound(err: NotFoundException, req: SolumjsRequest) {
        getFrameworkLogger().warn({ path: req.path, statusCode: err.statusCode }, err.message);
        return { status: "error", code: "NOT_FOUND", message: err.message };
    }

    @ExceptionHandler(BadRequestException)
    handleBadRequest(err: BadRequestException, req: SolumjsRequest) {
        getFrameworkLogger().warn({ path: req.path, statusCode: err.statusCode }, err.message);
        return { status: "error", code: "BAD_REQUEST", message: err.message };
    }

    @ExceptionHandler(InvalidQueryParameterException)
    handleInvalidQueryParameter(err: InvalidQueryParameterException, req: SolumjsRequest) {
        getFrameworkLogger().warn({ path: req.path, statusCode: err.statusCode }, err.message);
        return { status: "error", code: "INVALID_QUERY_PARAMETER", message: err.message };
    }

    @ExceptionHandler(ServiceUnavailableException)
    handleServiceUnavailable(err: ServiceUnavailableException, req: SolumjsRequest) {
        getFrameworkLogger().warn({ path: req.path, statusCode: err.statusCode }, err.message);
        return { status: "error", code: "SERVICE_UNAVAILABLE", message: err.message };
    }

    @ExceptionHandler(UnauthorizedException)
    handleUnauthorized(err: UnauthorizedException, req: SolumjsRequest) {
        getFrameworkLogger().warn({ path: req.path, statusCode: err.statusCode }, err.message);
        return { status: "error", code: "UNAUTHORIZED", message: err.message };
    }

    @ExceptionHandler(ForbiddenException)
    handleForbidden(err: ForbiddenException, req: SolumjsRequest) {
        getFrameworkLogger().warn({ path: req.path, statusCode: err.statusCode }, err.message);
        return { status: "error", code: "FORBIDDEN", message: err.message };
    }

    @ExceptionHandler(HttpException)
    handleHttpException(err: HttpException, req: SolumjsRequest) {
        getFrameworkLogger().warn({ path: req.path, statusCode: err.statusCode }, err.message);
        return { status: "error", message: err.message };
    }
}