export class HttpException extends Error {
    constructor(public statusCode: number, message: string) {
        super(message);
        this.name = this.constructor.name;
        Error.captureStackTrace(this, this.constructor);
    }
}

export class NotFoundException extends HttpException {
    constructor(message: string) {
        super(404, message);
    }
}

export class BadRequestException extends HttpException {
    constructor(message: string) {
        super(400, message);
    }
}

export class InvalidQueryParameterException extends HttpException {
    constructor(message: string) {
        super(400, message);
    }
}

export class ConflictException extends HttpException {
    constructor(message: string) {
        super(409, message);
    }
}

export class ServiceUnavailableException extends HttpException {
    constructor(message: string) {
        super(503, message);
    }
}

export class UnauthorizedException extends HttpException {
    constructor(message: string = "Unauthorized") {
        super(401, message);
    }
}

export class ForbiddenException extends HttpException {
    constructor(message: string = "Forbidden") {
        super(403, message);
    }
}

export class PayloadTooLargeException extends HttpException {
    constructor(message: string = "Payload too large") {
        super(413, message);
    }
}