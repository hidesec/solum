import { Bean } from "@solumjs/core";
import { SolumjsRequest } from "@solumjs/http";
import {
    BadRequestException,
    ConflictException,
    NotFoundException,
    UnauthorizedException,
    ForbiddenException,
} from "@solumjs/core";
import { ServiceUnavailableException } from "@solumjs/core";

const isProduction = process.env.NODE_ENV === "production";

function safeMessage(err: Error, fallback: string): string {
    if (isProduction) return fallback;
    return err.message;
}

@Bean()
export class GlobalExceptionHandler {
    handleNotFound(err: NotFoundException, req: SolumjsRequest) {
        req.log.warn({ path: req.path, code: 404 }, err.message);
        return { status: "error", code: "NOT_FOUND", message: safeMessage(err, "Resource not found") };
    }

    handleBadRequest(err: BadRequestException, req: SolumjsRequest) {
        req.log.warn({ path: req.path, code: 400 }, err.message);
        return { status: "error", code: "BAD_REQUEST", message: safeMessage(err, "Bad request") };
    }

    handleUnauthorized(err: UnauthorizedException, req: SolumjsRequest) {
        req.log.warn({ path: req.path, code: 401 }, err.message);
        return { status: "error", code: "UNAUTHORIZED", message: safeMessage(err, "Unauthorized") };
    }

    handleForbidden(err: ForbiddenException, req: SolumjsRequest) {
        req.log.warn({ path: req.path, code: 403 }, err.message);
        return { status: "error", code: "FORBIDDEN", message: safeMessage(err, "Forbidden") };
    }

    handleConflict(err: ConflictException, req: SolumjsRequest) {
        req.log.warn({ path: req.path, code: 409 }, err.message);
        return { status: "error", code: "CONFLICT", message: safeMessage(err, "Resource conflict") };
    }

    handleServiceUnavailable(err: ServiceUnavailableException, req: SolumjsRequest) {
        req.log.error({ path: req.path, code: 503 }, err.message);
        return { status: "error", code: "SERVICE_UNAVAILABLE", message: safeMessage(err, "Service unavailable") };
    }
}
