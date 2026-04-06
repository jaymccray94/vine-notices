import type { Request, Response, NextFunction } from "express";

interface RateLimitEntry {
  count: number;
  windowStart: number;
}

const store = new Map<string, RateLimitEntry>();

// Clean up stale entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  const stale: string[] = [];
  store.forEach((entry, key) => {
    if (now - entry.windowStart > 120_000) {
      stale.push(key);
    }
  });
  stale.forEach((key) => store.delete(key));
}, 5 * 60 * 1000);

/**
 * Rate limiter supporting both IP-based and user-based keys.
 * @param maxRequests - Maximum requests allowed in the time window
 * @param windowMs - Time window in milliseconds (default: 60s)
 * @param keyStrategy - "ip" (default), "user" (userId+IP), or "user-only" (userId only)
 */
export function rateLimit(maxRequests: number, windowMs = 60_000, keyStrategy: "ip" | "user" | "user-only" = "ip") {
  return (req: Request, res: Response, next: NextFunction) => {
    let key: string;
    const ip = req.ip || req.socket.remoteAddress || "unknown";
    const userId = (req as any).user?.userId;

    switch (keyStrategy) {
      case "user":
        key = userId ? `user:${userId}:${ip}` : `ip:${ip}`;
        break;
      case "user-only":
        key = userId ? `user:${userId}` : `ip:${ip}`;
        break;
      default:
        key = `ip:${ip}`;
    }

    const now = Date.now();
    const entry = store.get(key);

    if (!entry || now - entry.windowStart > windowMs) {
      store.set(key, { count: 1, windowStart: now });
      return next();
    }

    entry.count++;
    if (entry.count > maxRequests) {
      res.setHeader("Retry-After", String(Math.ceil((entry.windowStart + windowMs - now) / 1000)));
      return res.status(429).json({
        code: "RATE_LIMITED",
        message: "Too many requests. Please try again later.",
      });
    }

    next();
  };
}
