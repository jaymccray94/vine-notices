import { Router } from "express";
import { OAuth2Client } from "google-auth-library";
import { storage } from "../storage";
import { magicLinkRequestSchema, magicLinkVerifySchema } from "@shared/schema";
import { requireAuth, createSession, deleteSession, setAuthCookie, clearAuthCookie } from "../middleware/auth";
import { rateLimit } from "../middleware/rate-limit";
import { logger } from "../lib/logger";

const router = Router();

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";

// ── Auth Config ──
router.get("/api/auth/config", async (_req, res) => {
  res.json({
    googleClientId: GOOGLE_CLIENT_ID || null,
    ssoEnabled: !!GOOGLE_CLIENT_ID,
    allowEmailAuth: true,
    allowPasswordAuth: true,
    orgName: "Vine Management",
    demoMode: !GOOGLE_CLIENT_ID,
  });
});

// ── Google OAuth ──
router.post("/api/auth/google", rateLimit(10, 60_000), async (req, res) => {
  const { credential } = req.body;
  if (!credential) return res.status(400).json({ error: "Missing credential" });

  if (!GOOGLE_CLIENT_ID) {
    return res.status(400).json({ error: "Google sign-in is not configured" });
  }

  try {
    const client = new OAuth2Client(GOOGLE_CLIENT_ID);
    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    if (!payload || !payload.email) {
      return res.status(401).json({ error: "Invalid token payload" });
    }

    let user = await storage.getUserByEmail(payload.email);
    if (!user) {
      user = await storage.createUser({
        email: payload.email,
        name: payload.name || payload.email.split("@")[0],
        role: "staff",
      });
      logger.info({ email: payload.email }, "Auto-created user via Google sign-in");
    }

    if (!user.active) {
      return res.status(403).json({ error: "Your account has been deactivated" });
    }

    const token = createSession({
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      organizationId: user.organizationId ?? 1,
    });
    setAuthCookie(res, token);
    const associations = await storage.getUserAssociations(user.id);
    logger.info({ userId: user.id, email: user.email }, "Google sign-in successful");
    res.json({ token, user: { ...user, associations } });
  } catch (err) {
    logger.error({ err }, "Google auth error");
    res.status(401).json({ error: "Invalid Google token" });
  }
});

// ── Email/Password Auth ──
router.post("/api/auth/password", rateLimit(10, 60_000), async (req, res) => {
  const bcrypt = await import("bcryptjs");
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: "Email and password required" });

  try {
    const user = await storage.getUserByEmail(email.toLowerCase());
    if (!user) return res.status(401).json({ error: "Invalid email or password" });
    if (!user.active) return res.status(403).json({ error: "Account deactivated" });

    const fullUser = await storage.getUserById(user.id);
    const passwordHash = fullUser?.passwordHash;
    if (!passwordHash) {
      return res.status(401).json({ error: "This account uses a different sign-in method" });
    }

    const valid = await bcrypt.compare(password, passwordHash);
    if (!valid) return res.status(401).json({ error: "Invalid email or password" });

    const token = createSession({
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      organizationId: user.organizationId ?? 1,
    });
    setAuthCookie(res, token);
    const associations = await storage.getUserAssociations(user.id);
    logger.info({ userId: user.id, email: user.email }, "Password sign-in successful");
    res.json({ token, user: { ...user, associations } });
  } catch (err) {
    logger.error({ err }, "Password auth error");
    res.status(500).json({ error: "Login failed" });
  }
});

// ── Change Password ──
router.post("/api/auth/change-password", requireAuth, async (req, res) => {
  const bcrypt = await import("bcryptjs");
  const { newPassword } = req.body;
  if (!newPassword || newPassword.length < 8) {
    return res.status(400).json({ error: "Password must be at least 8 characters" });
  }
  try {
    const hash = await bcrypt.hash(newPassword, 12);
    await storage.updateUser(req.user!.userId, { passwordHash: hash } as any);
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Failed to change password" });
  }
});

// ── Magic Link Auth ──
router.post("/api/auth/magic-link", rateLimit(5, 60_000), async (req, res) => {
  const parsed = magicLinkRequestSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid email" });

  const user = await storage.getUserByEmail(parsed.data.email);
  if (!user) {
    return res.json({ sent: true });
  }

  const code = await storage.createMagicCode(parsed.data.email);

  logger.info({ email: parsed.data.email }, "Magic link code generated");
  console.log(`\n🔑 Magic link code for ${parsed.data.email}: ${code}\n`);

  const isDemoMode = !process.env.EMAIL_PROVIDER;
  res.json({ sent: true, ...(isDemoMode ? { demoCode: code } : {}) });
});

// ── Verify Code ──
router.post("/api/auth/verify-code", rateLimit(10, 60_000), async (req, res) => {
  const parsed = magicLinkVerifySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input" });

  const user = await storage.getUserByEmail(parsed.data.email);
  if (!user) return res.status(401).json({ error: "Invalid code" });

  const valid = await storage.verifyMagicCode(parsed.data.email, parsed.data.code);
  if (!valid) return res.status(401).json({ error: "Invalid or expired code" });

  const token = createSession({
    userId: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    organizationId: user.organizationId ?? 1,
  });
  setAuthCookie(res, token);
  const associations = await storage.getUserAssociations(user.id);
  logger.info({ userId: user.id, email: user.email }, "User logged in");
  res.json({ token, user: { ...user, associations } });
});

// ── Me ──
router.get("/api/auth/me", requireAuth, async (req, res) => {
  const user = req.user!;
  const fullUser = await storage.getUserById(user.userId);
  if (!fullUser) return res.status(401).json({ error: "User not found" });
  const associations = await storage.getUserAssociations(user.userId);
  res.json({ ...fullUser, associations });
});

// ── Logout ──
router.post("/api/auth/logout", async (req, res) => {
  const token = req.cookies?.vine_session || req.headers.authorization?.replace("Bearer ", "");
  if (token) deleteSession(token);
  clearAuthCookie(res);
  res.json({ ok: true });
});

export default router;
