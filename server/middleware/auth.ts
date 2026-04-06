import type { Request, Response, NextFunction } from "express";
import crypto from "crypto";

// ============ SESSION TYPES ============

export interface SessionData {
  userId: string;
  email: string;
  name: string;
  role: string;
  organizationId: number;
  expiresAt: number;
}

// Extend Express Request to include user context
declare global {
  namespace Express {
    interface Request {
      user?: SessionData;
      orgId?: number;
      id?: string;
    }
  }
}

// ============ SESSION STORE ============

const sessions = new Map<string, SessionData>();

export const SESSION_TTL = 24 * 60 * 60 * 1000; // 24 hours

// Clean up expired sessions every 15 minutes
setInterval(() => {
  const now = Date.now();
  const expired: string[] = [];
  sessions.forEach((session, token) => {
    if (session.expiresAt <= now) {
      expired.push(token);
    }
  });
  expired.forEach((token) => sessions.delete(token));
}, 15 * 60 * 1000);

export function createSession(data: Omit<SessionData, "expiresAt">): string {
  const token = crypto.randomBytes(32).toString("hex");
  sessions.set(token, { ...data, expiresAt: Date.now() + SESSION_TTL });
  return token;
}

export function getSession(token: string): SessionData | undefined {
  const session = sessions.get(token);
  if (session && session.expiresAt > Date.now()) return session;
  if (session) sessions.delete(token);
  return undefined;
}

export function deleteSession(token: string): void {
  sessions.delete(token);
}

/**
 * Invalidate all sessions for a user except the current token.
 */
export function invalidateUserSessions(userId: string, exceptToken?: string): void {
  const toDelete: string[] = [];
  sessions.forEach((session, token) => {
    if (session.userId === userId && token !== exceptToken) {
      toDelete.push(token);
    }
  });
  toDelete.forEach((token) => sessions.delete(token));
}

// ============ SESSION MIDDLEWARE ============

export function sessionResolver(req: Request, _res: Response, next: NextFunction): void {
  // Support both: httpOnly cookie (preferred) and Authorization header (backward compat)
  const token = req.cookies?.vine_session || req.headers.authorization?.replace("Bearer ", "");
  if (token) {
    const session = getSession(token);
    if (session) {
      req.user = session;
      req.orgId = session.organizationId;
    }
  }
  next();
}

/**
 * Set the auth cookie on a response (httpOnly, secure in production).
 */
export function setAuthCookie(res: Response, token: string): void {
  const isProduction = process.env.NODE_ENV === "production";
  res.cookie("vine_session", token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "strict" : "lax",
    maxAge: SESSION_TTL,
    path: "/",
  });
}

/**
 * Clear the auth cookie.
 */
export function clearAuthCookie(res: Response): void {
  res.clearCookie("vine_session", { path: "/" });
}

// ============ AUTH MIDDLEWARE ============

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ code: "UNAUTHORIZED", error: "Not authenticated" });
  }
  next();
}

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ code: "UNAUTHORIZED", error: "Not authenticated" });
    }
    // super_admin always passes
    if (req.user.role === "super_admin") {
      return next();
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ code: "FORBIDDEN", error: "Insufficient permissions" });
    }
    next();
  };
}

export function requireSuperAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ code: "UNAUTHORIZED", error: "Not authenticated" });
  }
  if (req.user.role !== "super_admin") {
    return res.status(403).json({ code: "FORBIDDEN", error: "Super admin access required" });
  }
  next();
}
