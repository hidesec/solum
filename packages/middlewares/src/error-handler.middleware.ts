import { getFrameworkLogger } from "@solumjs/core";
import { HttpException } from "@solumjs/core";
import { SolumjsRequest, SolumjsResponse } from "@solumjs/http";

const isProduction = process.env.NODE_ENV === "production";

export function errorHandler(err: Error, req: SolumjsRequest, res: SolumjsResponse): void {
    if (err instanceof HttpException) {
        getFrameworkLogger().warn({ path: req.path, statusCode: err.statusCode }, err.message);
        res.status(err.statusCode).json({
            status: "error",
            message: err.message,
        });
        return;
    }

    getFrameworkLogger().error({ err, path: req.path }, "Unhandled exception");
    res.status(500).json({
        status: "error",
        message: isProduction ? "Internal Server Error" : err.message,
    });
}