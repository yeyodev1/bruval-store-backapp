import { Request, Response, NextFunction } from "express";
import { ErrorHandler } from "../errors/errorHandler.error";

export function globalErrorHandler(error: any, req: Request, res: Response, _next: NextFunction) {
  const handler = new ErrorHandler(process.env.SLACK_ERROR_WEBHOOK || "");
  const status = error.status || 500;
  const message = error.message || "Internal Server Error";

  handler.handleHttpError(res, message, status, error);
}
