import { SolumjsRequest, SolumjsResponse } from "@solumjs/http";

export function notFoundHandler(req: SolumjsRequest, res: SolumjsResponse): void {
    res.status(404).json({
        status: "error",
        message: "Route not found",
    });
}