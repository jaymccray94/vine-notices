/**
 * Structured JSON logger using Pino.
 * Replaces console.log throughout the application.
 *
 * Usage:
 *   import { logger } from "./lib/logger";
 *   logger.info({ noticeId: "123" }, "Notice created");
 *   logger.error({ err, userId: 5 }, "Failed to update user");
 */
import pino from "pino";

const isProduction = process.env.NODE_ENV === "production";

export const logger = pino({
  level: process.env.LOG_LEVEL || (isProduction ? "info" : "debug"),
  ...(isProduction
    ? {} // JSON output in production (machine-readable)
    : { transport: { target: "pino-pretty", options: { colorize: true } } }),
  base: {
    service: "vine-notices",
    env: process.env.NODE_ENV || "development",
  },
  serializers: {
    err: pino.stdSerializers.err,
    req: pino.stdSerializers.req,
    res: pino.stdSerializers.res,
  },
});

/**
 * Create a child logger with request context (trace ID, user, org).
 */
export function createRequestLogger(req: { id?: string; user?: { userId: string; organizationId: number } }) {
  return logger.child({
    traceId: req.id,
    userId: req.user?.userId,
    orgId: req.user?.organizationId,
  });
}
