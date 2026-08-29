import {
    HttpException,
    NotFoundException,
    BadRequestException,
    InvalidQueryParameterException,
    ConflictException,
    ServiceUnavailableException,
    UnauthorizedException,
    ForbiddenException,
    PayloadTooLargeException,
} from "../http-exceptions";

describe("HTTP Exceptions", () => {
    it("HttpException has correct status and message", () => {
        const err = new HttpException(418, "teapot");
        expect(err.statusCode).toBe(418);
        expect(err.message).toBe("teapot");
        expect(err.name).toBe("HttpException");
        expect(err instanceof Error).toBe(true);
    });

    it("NotFoundException has status 404", () => {
        const err = new NotFoundException("not found");
        expect(err.statusCode).toBe(404);
        expect(err.message).toBe("not found");
        expect(err.name).toBe("NotFoundException");
    });

    it("BadRequestException has status 400", () => {
        const err = new BadRequestException("bad request");
        expect(err.statusCode).toBe(400);
        expect(err.name).toBe("BadRequestException");
    });

    it("InvalidQueryParameterException has status 400", () => {
        const err = new InvalidQueryParameterException("invalid query");
        expect(err.statusCode).toBe(400);
        expect(err.name).toBe("InvalidQueryParameterException");
    });

    it("ConflictException has status 409", () => {
        const err = new ConflictException("conflict");
        expect(err.statusCode).toBe(409);
        expect(err.name).toBe("ConflictException");
    });

    it("ServiceUnavailableException has status 503", () => {
        const err = new ServiceUnavailableException("unavailable");
        expect(err.statusCode).toBe(503);
        expect(err.name).toBe("ServiceUnavailableException");
    });

    it("UnauthorizedException has status 401 and default message", () => {
        const err = new UnauthorizedException();
        expect(err.statusCode).toBe(401);
        expect(err.message).toBe("Unauthorized");
        expect(err.name).toBe("UnauthorizedException");
    });

    it("ForbiddenException has status 403 and default message", () => {
        const err = new ForbiddenException();
        expect(err.statusCode).toBe(403);
        expect(err.message).toBe("Forbidden");
        expect(err.name).toBe("ForbiddenException");
    });

    it("PayloadTooLargeException has status 413 and default message", () => {
        const err = new PayloadTooLargeException();
        expect(err.statusCode).toBe(413);
        expect(err.message).toBe("Payload too large");
        expect(err.name).toBe("PayloadTooLargeException");
    });

    it("all exceptions are instanceof HttpException", () => {
        const exceptions = [
            new NotFoundException(""),
            new BadRequestException(""),
            new InvalidQueryParameterException(""),
            new ConflictException(""),
            new ServiceUnavailableException(""),
            new UnauthorizedException(),
            new ForbiddenException(),
            new PayloadTooLargeException(),
        ];
        for (const err of exceptions) {
            expect(err).toBeInstanceOf(HttpException);
            expect(err).toBeInstanceOf(Error);
        }
    });
});
