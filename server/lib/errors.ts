/**
 * Standardized error response format for the API.
 * All error responses follow: { code: string, message: string, details?: unknown[] }
 */
import type { Response } from "express";

export interface ApiError {
  code: string;
  message: string;
  details?: unknown[];
}

const ERROR_CODES = {
  VALIDATION_ERROR: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  INTERNAL_ERROR: 500,
} as const;

type ErrorCode = keyof typeof ERROR_CODES;

/**
 * Send a standardized error response.
 */
export function sendError(res: Response, code: ErrorCode, message: string, details?: unknown[]): void {
  const status = ERROR_CODES[code];
  const body: ApiError = { code, message };
  if (details && details.length > 0) body.details = details;
  res.status(status).json(body);
}

/**
 * Catch-all error handler for route handlers.
 * Logs the error and sends a safe response.
 */
export function handleRouteError(res: Response, err: unknown, context?: string): void {
  const message = err instanceof Error ? err.message : String(err);
  const safeMessage = process.env.NODE_ENV === "production" ? "An unexpected error occurred" : message;

  console.error(`[${context || "Route"}] Error:`, message);

  sendError(res, "INTERNAL_ERROR", safeMessage);
}
