import {
    errorHandler,
} from "../error-handler.middleware";
import { notFoundHandler } from "../not-found.middleware";
import { requestLogger } from "../request-logger.middleware";
import { GlobalExceptionAdvice } from "../global-exception.advice";

function createMockReq(path = "/test") {
    return {
        path,
        method: "GET",
        headers: {},
        raw: {
            socket: { remoteAddress: "127.0.0.1" },
            on: jest.fn(),
        },
    } as any;
}

function createMockRes() {
    let _status = 200;
    let _body: any;
    const res = {
        status(code: number) { _status = code; return res; },
        json(data: any) { _body = data; return res; },
        raw: {
            statusCode: 200,
            on: jest.fn(),
            end: jest.fn(),
        },
        _status: () => _status,
        _body: () => _body,
    } as any;
    return res;
}

describe("errorHandler", () => {
    it("handles HttpException with correct status", () => {
        const { NotFoundException } = require("@solumjs/core");
        const err = new NotFoundException("not found");
        const req = createMockReq();
        const res = createMockRes();
        errorHandler(err, req, res);
        expect(res._status()).toBe(404);
        expect(res._body().message).toBe("not found");
    });

    it("handles generic Error with 500", () => {
        const req = createMockReq();
        const res = createMockRes();
        errorHandler(new Error("something broke"), req, res);
        expect(res._status()).toBe(500);
        expect(res._body().status).toBe("error");
    });

    it("handles BadRequestException", () => {
        const { BadRequestException } = require("@solumjs/core");
        const err = new BadRequestException("bad input");
        const req = createMockReq();
        const res = createMockRes();
        errorHandler(err, req, res);
        expect(res._status()).toBe(400);
    });
});

describe("notFoundHandler", () => {
    it("returns 404 JSON response", () => {
        const req = createMockReq("/unknown");
        const res = createMockRes();
        notFoundHandler(req, res);
        expect(res._status()).toBe(404);
        expect(res._body()).toEqual({ status: "error", message: "Route not found" });
    });
});

describe("requestLogger", () => {
    it("returns a middleware function", () => {
        const middleware = requestLogger();
        expect(typeof middleware).toBe("function");
    });

    it("calls next", () => {
        const middleware = requestLogger();
        const req = createMockReq();
        const res = createMockRes();
        const next = jest.fn();
        middleware(req, res, next);
        expect(next).toHaveBeenCalled();
    });

    it("assigns log to request", () => {
        const middleware = requestLogger();
        const req = createMockReq();
        const res = createMockRes();
        middleware(req, res, jest.fn());
        expect(req.log).toBeDefined();
        expect(typeof req.log.info).toBe("function");
    });
});

describe("GlobalExceptionAdvice", () => {
    it("handleNotFound returns 404 response", () => {
        const { NotFoundException } = require("@solumjs/core");
        const advice = new GlobalExceptionAdvice();
        const req = createMockReq("/missing");
        const result = advice.handleNotFound(new NotFoundException("not found"), req);
        expect(result.status).toBe("error");
        expect(result.code).toBe("NOT_FOUND");
    });

    it("handleBadRequest returns 400 response", () => {
        const { BadRequestException } = require("@solumjs/core");
        const advice = new GlobalExceptionAdvice();
        const req = createMockReq();
        const result = advice.handleBadRequest(new BadRequestException("bad"), req);
        expect(result.code).toBe("BAD_REQUEST");
    });

    it("handleUnauthorized returns 401 response", () => {
        const { UnauthorizedException } = require("@solumjs/core");
        const advice = new GlobalExceptionAdvice();
        const req = createMockReq();
        const result = advice.handleUnauthorized(new UnauthorizedException("unauth"), req);
        expect(result.code).toBe("UNAUTHORIZED");
    });

    it("handleForbidden returns 403 response", () => {
        const { ForbiddenException } = require("@solumjs/core");
        const advice = new GlobalExceptionAdvice();
        const req = createMockReq();
        const result = advice.handleForbidden(new ForbiddenException("forbidden"), req);
        expect(result.code).toBe("FORBIDDEN");
    });

    it("handleServiceUnavailable returns 503 response", () => {
        const { ServiceUnavailableException } = require("@solumjs/core");
        const advice = new GlobalExceptionAdvice();
        const req = createMockReq();
        const result = advice.handleServiceUnavailable(new ServiceUnavailableException("down"), req);
        expect(result.code).toBe("SERVICE_UNAVAILABLE");
    });

    it("handleInvalidQueryParameter returns response", () => {
        const { InvalidQueryParameterException } = require("@solumjs/core");
        const advice = new GlobalExceptionAdvice();
        const req = createMockReq();
        const result = advice.handleInvalidQueryParameter(new InvalidQueryParameterException("bad query"), req);
        expect(result.code).toBe("INVALID_QUERY_PARAMETER");
    });

    it("handleHttpException handles generic HttpException", () => {
        const { HttpException } = require("@solumjs/core");
        const advice = new GlobalExceptionAdvice();
        const req = createMockReq();
        const result = advice.handleHttpException(new HttpException(418, "teapot"), req);
        expect(result.status).toBe("error");
    });
});
