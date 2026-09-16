import type { Request, Response, NextFunction } from "express";
import { AppError, PaymentRequiredError } from "../utils/errors";
import { logger } from "../utils/logger";

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    const body: Record<string, unknown> = { error: err.message };
    if (err instanceof PaymentRequiredError) body.code = err.code;
    res.status(err.statusCode).json(body);
    return;
  }

  logger.error("Unhandled error:", err);
  res.status(500).json({ error: "Internal server error" });
}
