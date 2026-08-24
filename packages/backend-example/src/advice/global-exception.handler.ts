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

@Bean()
export class GlobalExceptionHandler {
    handleNotFound(err: NotFoundException, req: SolumjsRequest) {
        req.log.warn({ path: req.path, code: 404 }, err.message);
        return { status: "error", code: "NOT_FOUND", message: err.message };
    }

    handleBadRequest(err: BadRequestException, req: SolumjsRequest) {
        req.log.warn({ path: req.path, code: 400 }, err.message);
        return { status: "error", code: "BAD_REQUEST", message: err.message };
    }

    handleUnauthorized(err: UnauthorizedException, req: SolumjsRequest) {
        req.log.warn({ path: req.path, code: 401 }, err.message);
        return { status: "error", code: "UNAUTHORIZED", message: err.message };
    }

    handleForbidden(err: ForbiddenException, req: SolumjsRequest) {
        req.log.warn({ path: req.path, code: 403 }, err.message);
        return { status: "error", code: "FORBIDDEN", message: err.message };
    }

    handleConflict(err: ConflictException, req: SolumjsRequest) {
        req.log.warn({ path: req.path, code: 409 }, err.message);
        return { status: "error", code: "CONFLICT", message: err.message };
    }

    handleServiceUnavailable(err: ServiceUnavailableException, req: SolumjsRequest) {
        req.log.error({ path: req.path, code: 503 }, err.message);
        return { status: "error", code: "SERVICE_UNAVAILABLE", message: err.message };
    }
}
