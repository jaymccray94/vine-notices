import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { setStorage } from "./storage";
import { logger } from "./lib/logger";
import { sessionResolver } from "./middleware/auth";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import crypto from "crypto";

const app = express();
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

// ── Security headers ────────────────────────────────────────
app.use(helmet({
  crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: process.env.NODE_ENV === "production" ? {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://accounts.google.com", "https://apis.google.com", "https://www.gstatic.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://accounts.google.com", "https://fonts.googleapis.com"],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      connectSrc: ["'self'", "https://accounts.google.com", "https://oauth2.googleapis.com", "wss:"],
      frameSrc: ["'self'", "blob:", "https://accounts.google.com", "https://www.google.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
    },
  } : false, // Disable CSP in development for Vite HMR
}));

// ── CORS ────────────────────────────────────────────────────
const ALLOWED_ORIGINS = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(",")
  : ["http://localhost:5000", "http://localhost:3000"];

app.use(cors({
  origin: process.env.NODE_ENV === "production"
    ? (origin, callback) => {
        if (!origin || ALLOWED_ORIGINS.includes(origin) || origin.endsWith(".vinemgmt.app")) {
          callback(null, true);
        } else {
          callback(new Error("Not allowed by CORS"));
        }
      }
    : true,
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));

// ── Cookie parser (for httpOnly auth cookies) ───────────────
app.use(cookieParser());

// ── Request trace ID ────────────────────────────────────────
app.use((req: Request, _res: Response, next: NextFunction) => {
  req.id = req.headers["x-request-id"] as string || crypto.randomUUID();
  req.orgId = req.orgId || 1;
  next();
});

// ── Session resolver (populates req.user from cookie/header) ─
app.use(sessionResolver);

// ── CSRF protection via Origin check (for state-changing requests) ──
if (process.env.NODE_ENV === "production") {
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) {
      const origin = req.headers.origin;
      const appUrl = process.env.APP_URL || "";
      if (origin && appUrl && !origin.startsWith(appUrl) && !origin.endsWith(".vinemgmt.app")) {
        if (!req.path.startsWith("/api/webhooks/")) {
          return res.status(403).json({ code: "CSRF_ERROR", message: "Cross-origin request blocked" });
        }
      }
    }
    next();
  });
}

// ── Body parsing with safe limits ───────────────────────────
app.use(
  express.json({
    limit: "10mb",
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);
app.use(express.urlencoded({ extended: false, limit: "1mb" }));

// ── Request logging ─────────────────────────────────────────
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - start;
    if (req.path.startsWith("/api")) {
      logger.info({
        method: req.method,
        path: req.path,
        status: res.statusCode,
        duration,
        traceId: req.id,
        userId: (req as any).user?.userId,
      }, `${req.method} ${req.path} ${res.statusCode} ${duration}ms`);
    }
  });
  next();
});

// For backward compatibility
export function log(message: string, source = "express") {
  logger.info({ source }, message);
}

(async () => {
  // Use PostgreSQL when DATABASE_URL is provided, otherwise fall back to in-memory storage
  if (process.env.DATABASE_URL) {
    const { DatabaseStorage } = await import("./db-storage");
    setStorage(new DatabaseStorage());
    logger.info("Using PostgreSQL database storage");
  } else {
    logger.info("Using in-memory storage (no DATABASE_URL)");
  }

  await registerRoutes(httpServer, app);

  // ── Enhanced health check ───────────────────────────────
  app.get("/api/health", async (_req, res) => {
    const checks: Record<string, string> = {};
    try {
      if (process.env.DATABASE_URL) {
        const { pool } = await import("./db");
        await pool.query("SELECT 1");
        checks.database = "ok";
      } else {
        checks.database = "in-memory";
      }
    } catch {
      checks.database = "error";
    }

    const allOk = checks.database !== "error";
    res.status(allOk ? 200 : 503).json({
      status: allOk ? "healthy" : "degraded",
      checks,
      uptime: Math.floor(process.uptime()),
      version: process.env.npm_package_version || "1.0.0",
    });
  });

  // ── Global error handler ──────────────────────────────────
  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    logger.error({ err }, "Unhandled error");
    if (res.headersSent) return next(err);
    res.status(err.status || 500).json({
      code: "INTERNAL_ERROR",
      message: process.env.NODE_ENV === "production" ? "An unexpected error occurred" : err.message,
    });
  });

  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen({ port, host: "0.0.0.0", reusePort: true }, () => {
    logger.info({ port }, `Server listening on port ${port}`);
  });

  // ── Graceful shutdown ─────────────────────────────────────
  const shutdown = async (signal: string) => {
    logger.info({ signal }, "Shutdown signal received, closing gracefully...");

    httpServer.close(() => {
      logger.info("HTTP server closed");
      process.exit(0);
    });

    // Force exit after 30 seconds
    setTimeout(() => {
      logger.error("Forced shutdown after timeout");
      process.exit(1);
    }, 30_000);
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
})().catch((err) => {
  console.error("FATAL: Server failed to start:", err);
  process.exit(1);
});
