import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { storage, FLORIDA_DOCUMENT_CATEGORIES } from "./storage";
import { magicLinkRequestSchema, magicLinkVerifySchema, insertUserSchema, insertAssociationSchema, insertNoticeSchema, insertMeetingSchema, insertTicketSchema, insertInsurancePolicySchema, insertMailingRequestSchema, insertOnboardingChecklistSchema, insertAccountingItemSchema, insertInvoiceSchema } from "@shared/schema";

// ── Session tokens ──
const sessions = new Map<string, { userId: string; expiresAt: number }>();

function createToken(userId: string): string {
  const token = crypto.randomBytes(32).toString("hex");
  sessions.set(token, { userId, expiresAt: Date.now() + 24 * 60 * 60 * 1000 });
  return token;
}

async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) return res.status(401).json({ error: "Not authenticated" });
  const session = sessions.get(token);
  if (!session || session.expiresAt < Date.now()) {
    sessions.delete(token || "");
    return res.status(401).json({ error: "Session expired" });
  }
  const user = await storage.getUserById(session.userId);
  if (!user) return res.status(401).json({ error: "User not found" });
  (req as any).user = user;
  next();
}

function requireSuperAdmin(req: Request, res: Response, next: NextFunction) {
  if ((req as any).user.role !== "super_admin") {
    return res.status(403).json({ error: "Super admin access required" });
  }
  next();
}

// ── File upload ──
const uploadDir = path.resolve(process.cwd(), "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadDir),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname);
      cb(null, crypto.randomUUID() + ext);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "image/jpeg",
      "image/png",
    ];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error("File type not supported. Accepted: PDF, Word, Excel, JPEG, PNG."));
  },
});

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {

  // Health check endpoint for Railway (no auth required)
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  const meetingNoticesStore: any[] = [];
  const meetingMinutesStore: any[] = [];

  // ══════════════════════════════════════════════
  // ── Magic Link Auth ──
  // ══════════════════════════════════════════════

  // Step 1: Request a magic code
  app.post("/api/auth/magic-link", async (req, res) => {
    const parsed = magicLinkRequestSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid email" });

    const user = await storage.getUserByEmail(parsed.data.email);
    if (!user) {
      // Don't reveal whether user exists — always say "sent"
      return res.json({ sent: true });
    }

    const code = await storage.createMagicCode(parsed.data.email);

    // ──────────────────────────────────────────
    // 🔌 EMAIL INTEGRATION POINT
    // In production, send `code` to `parsed.data.email` via your email provider.
    // Examples:
    //   - Gmail API: Use googleapis to send from your domain
    //   - Resend:    await resend.emails.send({ to: email, subject: "Your login code", html: `<p>Your code: <b>${code}</b></p>` })
    //   - SendGrid:  await sgMail.send({ to: email, subject: "Your login code", text: `Your code: ${code}` })
    //
    // For this demo, the code is logged to the server console.
    // ──────────────────────────────────────────
    console.log(`\n🔑 Magic link code for ${parsed.data.email}: ${code}\n`);

    // In demo mode, also return the code so the UI can show it
    const isDemoMode = !process.env.EMAIL_PROVIDER;
    res.json({ sent: true, ...(isDemoMode ? { demoCode: code } : {}) });
  });

  // Step 2: Verify the code and log in
  app.post("/api/auth/verify-code", async (req, res) => {
    const parsed = magicLinkVerifySchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid input" });

    const user = await storage.getUserByEmail(parsed.data.email);
    if (!user) return res.status(401).json({ error: "Invalid code" });

    const valid = await storage.verifyMagicCode(parsed.data.email, parsed.data.code);
    if (!valid) return res.status(401).json({ error: "Invalid or expired code" });

    const token = createToken(user.id);
    const associations = await storage.getUserAssociations(user.id);
    res.json({ token, user: { ...user, associations } });
  });

  app.get("/api/auth/me", requireAuth, async (req, res) => {
    const user = (req as any).user;
    const associations = await storage.getUserAssociations(user.id);
    res.json({ ...user, associations });
  });

  app.post("/api/auth/logout", async (req, res) => {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (token) sessions.delete(token);
    res.json({ ok: true });
  });

  // ══════════════════════════════════════════════
  // ── Associations ──
  // ══════════════════════════════════════════════

  app.get("/api/associations", requireAuth, async (_req, res) => {
    const user = (_req as any).user;
    let associations = await storage.listAssociations();
    if (user.role !== "super_admin") {
      const userAssocs = await storage.getUserAssociations(user.id);
      const ids = new Set(userAssocs.map((ua: any) => ua.associationId));
      associations = associations.filter((a) => ids.has(a.id));
    }
    res.json(associations);
  });

  app.post("/api/associations", requireAuth, requireSuperAdmin, async (req, res) => {
    const parsed = insertAssociationSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    if (await storage.getAssociationBySlug(parsed.data.slug)) {
      return res.status(409).json({ error: "An association with this slug already exists" });
    }
    const assoc = await storage.createAssociation(parsed.data);
    res.status(201).json(assoc);
  });

  app.patch("/api/associations/:id", requireAuth, requireSuperAdmin, async (req, res) => {
    const updated = await storage.updateAssociation(req.params.id, req.body);
    if (!updated) return res.status(404).json({ error: "Not found" });
    res.json(updated);
  });

  app.delete("/api/associations/:id", requireAuth, requireSuperAdmin, async (req, res) => {
    await storage.deleteAssociation(req.params.id);
    res.json({ ok: true });
  });

  // ══════════════════════════════════════════════
  // ── Users ──
  // ══════════════════════════════════════════════

  app.get("/api/users", requireAuth, requireSuperAdmin, async (_req, res) => {
    res.json(await storage.listUsers());
  });

  app.post("/api/users", requireAuth, requireSuperAdmin, async (req, res) => {
    const parsed = insertUserSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    if (await storage.getUserByEmail(parsed.data.email)) {
      return res.status(409).json({ error: "A user with this email already exists" });
    }
    const user = await storage.createUser(parsed.data);
    res.status(201).json(user);
  });

  app.patch("/api/users/:id", requireAuth, requireSuperAdmin, async (req, res) => {
    const updated = await storage.updateUser(req.params.id, req.body);
    if (!updated) return res.status(404).json({ error: "Not found" });
    res.json(updated);
  });

  app.delete("/api/users/:id", requireAuth, requireSuperAdmin, async (req, res) => {
    await storage.deleteUser(req.params.id);
    res.json({ ok: true });
  });

  app.put("/api/users/:id/associations", requireAuth, requireSuperAdmin, async (req, res) => {
    const { assignments } = req.body;
    if (!Array.isArray(assignments)) return res.status(400).json({ error: "assignments array required" });
    await storage.setUserAssociations(req.params.id, assignments);
    res.json(await storage.getUserAssociations(req.params.id));
  });

  // ══════════════════════════════════════════════
  // ── Notices ──
  // ══════════════════════════════════════════════

  app.get("/api/associations/:assocId/notices", requireAuth, async (req, res) => {
    const user = (req as any).user;
    if (!await storage.canUserAccessAssociation(user.id, req.params.assocId)) {
      return res.status(403).json({ error: "Access denied" });
    }
    res.json(await storage.listNotices(req.params.assocId));
  });

  app.post("/api/associations/:assocId/notices", requireAuth, async (req, res) => {
    const user = (req as any).user;
    if (!await storage.canUserAccessAssociation(user.id, req.params.assocId, true)) {
      return res.status(403).json({ error: "Manage permission required" });
    }
    const parsed = insertNoticeSchema.safeParse({ ...req.body, associationId: req.params.assocId });
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const notice = await storage.createNotice(parsed.data, user.id);
    res.status(201).json(notice);
  });

  app.patch("/api/notices/:id", requireAuth, async (req, res) => {
    const notice = await storage.getNotice(req.params.id);
    if (!notice) return res.status(404).json({ error: "Not found" });
    const user = (req as any).user;
    if (!await storage.canUserAccessAssociation(user.id, notice.associationId, true)) {
      return res.status(403).json({ error: "Manage permission required" });
    }
    const updated = await storage.updateNotice(req.params.id, req.body);
    res.json(updated);
  });

  app.delete("/api/notices/:id", requireAuth, async (req, res) => {
    const notice = await storage.getNotice(req.params.id);
    if (!notice) return res.status(404).json({ error: "Not found" });
    const user = (req as any).user;
    if (!await storage.canUserAccessAssociation(user.id, notice.associationId, true)) {
      return res.status(403).json({ error: "Manage permission required" });
    }
    if (notice.pdfFilename) {
      const filePath = path.join(uploadDir, notice.pdfFilename);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
    await storage.deleteNotice(req.params.id);
    res.json({ ok: true });
  });

  // ── PDF Upload ──
  app.post("/api/notices/:id/pdf", requireAuth, upload.single("pdf"), async (req, res) => {
    const notice = await storage.getNotice(req.params.id);
    if (!notice) return res.status(404).json({ error: "Notice not found" });
    const user = (req as any).user;
    if (!await storage.canUserAccessAssociation(user.id, notice.associationId, true)) {
      return res.status(403).json({ error: "Manage permission required" });
    }
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });
    if (notice.pdfFilename) {
      const old = path.join(uploadDir, notice.pdfFilename);
      if (fs.existsSync(old)) fs.unlinkSync(old);
    }
    await storage.setNoticePdf(req.params.id, req.file.filename);
    res.json({ filename: req.file.filename });
  });

  app.delete("/api/notices/:id/pdf", requireAuth, async (req, res) => {
    const notice = await storage.getNotice(req.params.id);
    if (!notice) return res.status(404).json({ error: "Not found" });
    const user = (req as any).user;
    if (!await storage.canUserAccessAssociation(user.id, notice.associationId, true)) {
      return res.status(403).json({ error: "Manage permission required" });
    }
    if (notice.pdfFilename) {
      const filePath = path.join(uploadDir, notice.pdfFilename);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
    await storage.setNoticePdf(req.params.id, null);
    res.json({ ok: true });
  });

  app.get("/api/uploads/:filename", async (req, res) => {
    const filePath = path.join(uploadDir, req.params.filename);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: "File not found" });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${req.params.filename}"`);
    fs.createReadStream(filePath).pipe(res);
  });

  // ══════════════════════════════════════════════
  // ── Meetings ──
  // ══════════════════════════════════════════════

  app.get("/api/associations/:assocId/meetings", requireAuth, async (req, res) => {
    const user = (req as any).user;
    if (!await storage.canUserAccessAssociation(user.id, req.params.assocId)) {
      return res.status(403).json({ error: "Access denied" });
    }
    res.json(await storage.listMeetings(req.params.assocId));
  });

  app.post("/api/associations/:assocId/meetings", requireAuth, async (req, res) => {
    const user = (req as any).user;
    if (!await storage.canUserAccessAssociation(user.id, req.params.assocId, true)) {
      return res.status(403).json({ error: "Manage permission required" });
    }
    const parsed = insertMeetingSchema.safeParse({ ...req.body, associationId: req.params.assocId });
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const meeting = await storage.createMeeting(parsed.data, user.id);
    res.status(201).json(meeting);
  });

  app.patch("/api/meetings/:id", requireAuth, async (req, res) => {
    const meeting = await storage.getMeeting(req.params.id);
    if (!meeting) return res.status(404).json({ error: "Not found" });
    const user = (req as any).user;
    if (!await storage.canUserAccessAssociation(user.id, meeting.associationId, true)) {
      return res.status(403).json({ error: "Manage permission required" });
    }
    const updated = await storage.updateMeeting(req.params.id, req.body);
    res.json(updated);
  });

  app.delete("/api/meetings/:id", requireAuth, async (req, res) => {
    const meeting = await storage.getMeeting(req.params.id);
    if (!meeting) return res.status(404).json({ error: "Not found" });
    const user = (req as any).user;
    if (!await storage.canUserAccessAssociation(user.id, meeting.associationId, true)) {
      return res.status(403).json({ error: "Manage permission required" });
    }
    await storage.deleteMeeting(req.params.id);
    res.json({ ok: true });
  });

  // ══════════════════════════════════════════════
  // ── Tickets ──
  // ══════════════════════════════════════════════

  app.get("/api/tickets/:associationId", requireAuth, async (req, res) => {
    const user = (req as any).user;
    if (!await storage.canUserAccessAssociation(user.id, req.params.associationId)) {
      return res.status(403).json({ error: "Access denied" });
    }
    res.json(await storage.listTickets(req.params.associationId));
  });

  app.post("/api/tickets/:associationId", requireAuth, async (req, res) => {
    const user = (req as any).user;
    if (!await storage.canUserAccessAssociation(user.id, req.params.associationId, true)) {
      return res.status(403).json({ error: "Manage permission required" });
    }
    const parsed = insertTicketSchema.safeParse({ ...req.body, associationId: req.params.associationId });
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const ticket = await storage.createTicket(parsed.data, user.id);
    res.status(201).json(ticket);
  });

  app.patch("/api/tickets/item/:id", requireAuth, async (req, res) => {
    const ticket = await storage.getTicket(req.params.id);
    if (!ticket) return res.status(404).json({ error: "Not found" });
    const user = (req as any).user;
    if (!await storage.canUserAccessAssociation(user.id, ticket.associationId, true)) {
      return res.status(403).json({ error: "Manage permission required" });
    }
    const updated = await storage.updateTicket(req.params.id, req.body);
    res.json(updated);
  });

  app.delete("/api/tickets/item/:id", requireAuth, async (req, res) => {
    const ticket = await storage.getTicket(req.params.id);
    if (!ticket) return res.status(404).json({ error: "Not found" });
    const user = (req as any).user;
    if (!await storage.canUserAccessAssociation(user.id, ticket.associationId, true)) {
      return res.status(403).json({ error: "Manage permission required" });
    }
    await storage.deleteTicket(req.params.id);
    res.json({ ok: true });
  });

  // ══════════════════════════════════════════════
  // ── Insurance Policies ──
  // ══════════════════════════════════════════════

  app.get("/api/insurance/:associationId", requireAuth, async (req, res) => {
    const user = (req as any).user;
    if (!await storage.canUserAccessAssociation(user.id, req.params.associationId)) {
      return res.status(403).json({ error: "Access denied" });
    }
    res.json(await storage.listInsurancePolicies(req.params.associationId));
  });

  app.post("/api/insurance/:associationId", requireAuth, async (req, res) => {
    const user = (req as any).user;
    if (!await storage.canUserAccessAssociation(user.id, req.params.associationId, true)) {
      return res.status(403).json({ error: "Manage permission required" });
    }
    const parsed = insertInsurancePolicySchema.safeParse({ ...req.body, associationId: req.params.associationId });
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const policy = await storage.createInsurancePolicy(parsed.data, user.id);
    res.status(201).json(policy);
  });

  app.patch("/api/insurance/item/:id", requireAuth, async (req, res) => {
    const policy = await storage.getInsurancePolicy(req.params.id);
    if (!policy) return res.status(404).json({ error: "Not found" });
    const user = (req as any).user;
    if (!await storage.canUserAccessAssociation(user.id, policy.associationId, true)) {
      return res.status(403).json({ error: "Manage permission required" });
    }
    const updated = await storage.updateInsurancePolicy(req.params.id, req.body);
    res.json(updated);
  });

  app.delete("/api/insurance/item/:id", requireAuth, async (req, res) => {
    const policy = await storage.getInsurancePolicy(req.params.id);
    if (!policy) return res.status(404).json({ error: "Not found" });
    const user = (req as any).user;
    if (!await storage.canUserAccessAssociation(user.id, policy.associationId, true)) {
      return res.status(403).json({ error: "Manage permission required" });
    }
    await storage.deleteInsurancePolicy(req.params.id);
    res.json({ ok: true });
  });

  // ══════════════════════════════════════════════
  // ── Mailing Requests ──
  // ══════════════════════════════════════════════

  app.get("/api/mailings/:associationId", requireAuth, async (req, res) => {
    const user = (req as any).user;
    if (!await storage.canUserAccessAssociation(user.id, req.params.associationId)) {
      return res.status(403).json({ error: "Access denied" });
    }
    res.json(await storage.listMailingRequests(req.params.associationId));
  });

  app.post("/api/mailings/:associationId", requireAuth, async (req, res) => {
    const user = (req as any).user;
    if (!await storage.canUserAccessAssociation(user.id, req.params.associationId, true)) {
      return res.status(403).json({ error: "Manage permission required" });
    }
    const parsed = insertMailingRequestSchema.safeParse({ ...req.body, associationId: req.params.associationId });
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const mailing = await storage.createMailingRequest(parsed.data, user.id);
    res.status(201).json(mailing);
  });

  app.patch("/api/mailings/item/:id", requireAuth, async (req, res) => {
    const mailing = await storage.getMailingRequest(req.params.id);
    if (!mailing) return res.status(404).json({ error: "Not found" });
    const user = (req as any).user;
    if (!await storage.canUserAccessAssociation(user.id, mailing.associationId, true)) {
      return res.status(403).json({ error: "Manage permission required" });
    }
    const updated = await storage.updateMailingRequest(req.params.id, req.body);
    res.json(updated);
  });

  app.delete("/api/mailings/item/:id", requireAuth, async (req, res) => {
    const mailing = await storage.getMailingRequest(req.params.id);
    if (!mailing) return res.status(404).json({ error: "Not found" });
    const user = (req as any).user;
    if (!await storage.canUserAccessAssociation(user.id, mailing.associationId, true)) {
      return res.status(403).json({ error: "Manage permission required" });
    }
    await storage.deleteMailingRequest(req.params.id);
    res.json({ ok: true });
  });

  // ══════════════════════════════════════════════
  // ── Onboarding Checklists ──
  // ══════════════════════════════════════════════

  app.get("/api/onboarding/:associationId", requireAuth, async (req, res) => {
    const user = (req as any).user;
    if (!await storage.canUserAccessAssociation(user.id, req.params.associationId)) {
      return res.status(403).json({ error: "Access denied" });
    }
    res.json(await storage.listOnboardingChecklists(req.params.associationId));
  });

  app.post("/api/onboarding/:associationId", requireAuth, async (req, res) => {
    const user = (req as any).user;
    if (!await storage.canUserAccessAssociation(user.id, req.params.associationId, true)) {
      return res.status(403).json({ error: "Manage permission required" });
    }
    const parsed = insertOnboardingChecklistSchema.safeParse({ ...req.body, associationId: req.params.associationId });
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const checklist = await storage.createOnboardingChecklist(parsed.data, user.id);
    res.status(201).json(checklist);
  });

  app.patch("/api/onboarding/item/:id", requireAuth, async (req, res) => {
    const checklist = await storage.getOnboardingChecklist(req.params.id);
    if (!checklist) return res.status(404).json({ error: "Not found" });
    const user = (req as any).user;
    if (!await storage.canUserAccessAssociation(user.id, checklist.associationId, true)) {
      return res.status(403).json({ error: "Manage permission required" });
    }
    const updated = await storage.updateOnboardingChecklist(req.params.id, req.body);
    res.json(updated);
  });

  app.delete("/api/onboarding/item/:id", requireAuth, async (req, res) => {
    const checklist = await storage.getOnboardingChecklist(req.params.id);
    if (!checklist) return res.status(404).json({ error: "Not found" });
    const user = (req as any).user;
    if (!await storage.canUserAccessAssociation(user.id, checklist.associationId, true)) {
      return res.status(403).json({ error: "Manage permission required" });
    }
    await storage.deleteOnboardingChecklist(req.params.id);
    res.json({ ok: true });
  });

  app.patch("/api/onboarding/item/:checklistId/toggle/:itemId", requireAuth, async (req, res) => {
    const checklist = await storage.getOnboardingChecklist(req.params.checklistId);
    if (!checklist) return res.status(404).json({ error: "Not found" });
    const user = (req as any).user;
    if (!await storage.canUserAccessAssociation(user.id, checklist.associationId, true)) {
      return res.status(403).json({ error: "Manage permission required" });
    }
    const updated = await storage.toggleOnboardingItem(req.params.checklistId, req.params.itemId);
    if (!updated) return res.status(404).json({ error: "Item not found" });
    res.json(updated);
  });

  // ══════════════════════════════════════════════
  // ── Accounting Items ──
  // ══════════════════════════════════════════════

  app.get("/api/accounting/:associationId", requireAuth, async (req, res) => {
    const user = (req as any).user;
    if (!await storage.canUserAccessAssociation(user.id, req.params.associationId)) {
      return res.status(403).json({ error: "Access denied" });
    }
    res.json(await storage.listAccountingItems(req.params.associationId));
  });

  app.post("/api/accounting/:associationId", requireAuth, async (req, res) => {
    const user = (req as any).user;
    if (!await storage.canUserAccessAssociation(user.id, req.params.associationId, true)) {
      return res.status(403).json({ error: "Manage permission required" });
    }
    const parsed = insertAccountingItemSchema.safeParse({ ...req.body, associationId: req.params.associationId });
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const item = await storage.createAccountingItem(parsed.data, user.id);
    res.status(201).json(item);
  });

  app.patch("/api/accounting/item/:id", requireAuth, async (req, res) => {
    const item = await storage.getAccountingItem(req.params.id);
    if (!item) return res.status(404).json({ error: "Not found" });
    const user = (req as any).user;
    if (!await storage.canUserAccessAssociation(user.id, item.associationId, true)) {
      return res.status(403).json({ error: "Manage permission required" });
    }
    const updated = await storage.updateAccountingItem(req.params.id, req.body);
    res.json(updated);
  });

  app.delete("/api/accounting/item/:id", requireAuth, async (req, res) => {
    const item = await storage.getAccountingItem(req.params.id);
    if (!item) return res.status(404).json({ error: "Not found" });
    const user = (req as any).user;
    if (!await storage.canUserAccessAssociation(user.id, item.associationId, true)) {
      return res.status(403).json({ error: "Manage permission required" });
    }
    await storage.deleteAccountingItem(req.params.id);
    res.json({ ok: true });
  });

  // ══════════════════════════════════════════════
  // ── Invoices ──
  // ══════════════════════════════════════════════

  app.get("/api/invoices/:associationId", requireAuth, async (req, res) => {
    const user = (req as any).user;
    if (!await storage.canUserAccessAssociation(user.id, req.params.associationId)) {
      return res.status(403).json({ error: "Access denied" });
    }
    res.json(await storage.listInvoices(req.params.associationId));
  });

  app.post("/api/invoices/:associationId", requireAuth, async (req, res) => {
    const user = (req as any).user;
    if (!await storage.canUserAccessAssociation(user.id, req.params.associationId, true)) {
      return res.status(403).json({ error: "Manage permission required" });
    }
    const parsed = insertInvoiceSchema.safeParse({ ...req.body, associationId: req.params.associationId });
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const invoice = await storage.createInvoice(parsed.data, user.id);
    res.status(201).json(invoice);
  });

  app.patch("/api/invoices/item/:id", requireAuth, async (req, res) => {
    const invoice = await storage.getInvoice(req.params.id);
    if (!invoice) return res.status(404).json({ error: "Not found" });
    const user = (req as any).user;
    if (!await storage.canUserAccessAssociation(user.id, invoice.associationId, true)) {
      return res.status(403).json({ error: "Manage permission required" });
    }
    const updated = await storage.updateInvoice(req.params.id, req.body);
    res.json(updated);
  });

  app.delete("/api/invoices/item/:id", requireAuth, async (req, res) => {
    const invoice = await storage.getInvoice(req.params.id);
    if (!invoice) return res.status(404).json({ error: "Not found" });
    const user = (req as any).user;
    if (!await storage.canUserAccessAssociation(user.id, invoice.associationId, true)) {
      return res.status(403).json({ error: "Manage permission required" });
    }
    await storage.deleteInvoice(req.params.id);
    res.json({ ok: true });
  });

  // ══════════════════════════════════════════════
  // ── Dashboard Stats ──
  // ══════════════════════════════════════════════

  app.get("/api/stats/:associationId", requireAuth, async (req, res) => {
    const user = (req as any).user;
    const { associationId } = req.params;
    if (!await storage.canUserAccessAssociation(user.id, associationId)) {
      return res.status(403).json({ error: "Access denied" });
    }

    const notices = await storage.listNotices(associationId).length;
    const meetings = await storage.listMeetings(associationId).length;

    const tickets = await storage.listTickets(associationId);
    const ticketOpen = tickets.filter((t) => t.status === "open").length;
    const ticketInProgress = tickets.filter((t) => t.status === "in_progress").length;

    const policies = await storage.listInsurancePolicies(associationId);
    const now60 = new Date();
    now60.setDate(now60.getDate() + 60);
    const expiringCutoff = now60.toISOString().slice(0, 10);
    const todayStr = new Date().toISOString().slice(0, 10);
    const expiringSoon = policies.filter(
      (p) => p.expirationDate >= todayStr && p.expirationDate <= expiringCutoff
    ).length;

    const mailings = await storage.listMailingRequests(associationId);
    const mailingPending = mailings.filter((m) => m.status === "pending_approval" || m.status === "draft").length;

    const checklists = await storage.listOnboardingChecklists(associationId);
    const allItems = checklists.flatMap((c) => c.items);
    const completedChecklists = checklists.filter((c) => c.items.length > 0 && c.items.every((i) => i.completed)).length;

    const accounting = await storage.listAccountingItems(associationId);
    const accountingOutstanding = accounting.filter((a) => a.status === "outstanding" || a.status === "partial").length;
    const accountingOverdue = accounting.filter((a) => a.status === "overdue").length;
    const totalOwed = accounting
      .filter((a) => a.status !== "paid" && a.status !== "written_off")
      .reduce((sum, a) => sum + (a.amount - a.amountPaid), 0);

    const invoices = await storage.listInvoices(associationId);
    const invoicesPending = invoices.filter((inv) => inv.status === "uploaded" || inv.status === "processing" || inv.status === "review").length;

    const documents = await storage.listDocuments(associationId);
    const docsCurrent = documents.filter((d) => d.status === "current").length;

    const vendors = await storage.listVendors(associationId);
    const vendorsActive = vendors.filter((v) => v.status === "active").length;

    res.json({
      notices,
      meetings,
      tickets: { open: ticketOpen, inProgress: ticketInProgress, total: tickets.length },
      insurance: { total: policies.length, expiringSoon },
      mailings: { pending: mailingPending, total: mailings.length },
      onboarding: {
        completed: completedChecklists,
        total: checklists.length,
        items: { completed: allItems.filter((i) => i.completed).length, total: allItems.length },
      },
      accounting: { outstanding: accountingOutstanding, overdue: accountingOverdue, totalOwed },
      invoices: { pending: invoicesPending, total: invoices.length },
      documents: { current: docsCurrent, total: documents.length },
      vendors: { active: vendorsActive, total: vendors.length },
    });
  });

  // ══════════════════════════════════════════════
  // ── Global Tickets (cross-association) ──
  // ══════════════════════════════════════════════

  app.get("/api/global/tickets", requireAuth, async (req, res) => {
    const user = (req as any).user;
    let tickets = await storage.listAllTickets();
    // Non-super-admins only see tickets for their assigned associations
    if (user.role !== "super_admin") {
      const userAssocs = await storage.getUserAssociations(user.id);
      const ids = new Set(userAssocs.map((ua: any) => ua.associationId));
      tickets = tickets.filter((t) => ids.has(t.associationId));
    }
    // Enrich with association names
    const enriched = await Promise.all(tickets.map(async (t) => {
      const assoc = await storage.getAssociation(t.associationId);
      return { ...t, associationName: assoc?.name || "Unknown", associationColor: assoc?.primaryColor || "#6B7280" };
    }));
    res.json(enriched);
  });

  // ══════════════════════════════════════════════
  // ── Vendors ──
  // ══════════════════════════════════════════════

  app.get("/api/vendors/:associationId", requireAuth, async (req, res) => {
    const user = (req as any).user;
    if (!await storage.canUserAccessAssociation(user.id, req.params.associationId)) {
      return res.status(403).json({ error: "Access denied" });
    }
    res.json(await storage.listVendors(req.params.associationId));
  });

  app.get("/api/global/vendors", requireAuth, async (req, res) => {
    const user = (req as any).user;
    let vendors = await storage.listAllVendors();
    if (user.role !== "super_admin") {
      const userAssocs = await storage.getUserAssociations(user.id);
      const ids = new Set(userAssocs.map((ua: any) => ua.associationId));
      vendors = vendors.filter((v) => ids.has(v.associationId));
    }
    const enriched = await Promise.all(vendors.map(async (v) => {
      const assoc = await storage.getAssociation(v.associationId);
      return { ...v, associationName: assoc?.name || "Unknown" };
    }));
    res.json(enriched);
  });

  app.post("/api/vendors/:associationId", requireAuth, async (req, res) => {
    const user = (req as any).user;
    if (!await storage.canUserAccessAssociation(user.id, req.params.associationId, true)) {
      return res.status(403).json({ error: "Manage permission required" });
    }
    const vendor = await storage.createVendor({
      associationId: req.params.associationId,
      name: req.body.name,
      contactName: req.body.contactName || null,
      phone: req.body.phone || null,
      email: req.body.email || null,
      category: req.body.category || "General",
      status: req.body.status || "active",
      insuranceExpiry: req.body.insuranceExpiry || null,
      notes: req.body.notes || null,
      cincVendorId: req.body.cincVendorId || null,
      createdBy: user.id,
    }, user.id);
    res.status(201).json(vendor);
  });

  app.patch("/api/vendors/item/:id", requireAuth, async (req, res) => {
    const vendor = await storage.getVendor(req.params.id);
    if (!vendor) return res.status(404).json({ error: "Not found" });
    const user = (req as any).user;
    if (!await storage.canUserAccessAssociation(user.id, vendor.associationId, true)) {
      return res.status(403).json({ error: "Manage permission required" });
    }
    const updated = await storage.updateVendor(req.params.id, req.body);
    res.json(updated);
  });

  app.delete("/api/vendors/item/:id", requireAuth, async (req, res) => {
    const vendor = await storage.getVendor(req.params.id);
    if (!vendor) return res.status(404).json({ error: "Not found" });
    const user = (req as any).user;
    if (!await storage.canUserAccessAssociation(user.id, vendor.associationId, true)) {
      return res.status(403).json({ error: "Manage permission required" });
    }
    await storage.deleteVendor(req.params.id);
    res.json({ ok: true });
  });

  // ══════════════════════════════════════════════
  // ── Documents Library ──
  // ══════════════════════════════════════════════

  app.get("/api/document-categories", requireAuth, async (_req, res) => {
    res.json(FLORIDA_DOCUMENT_CATEGORIES);
  });

  app.get("/api/documents/:associationId", requireAuth, async (req, res) => {
    const user = (req as any).user;
    if (!await storage.canUserAccessAssociation(user.id, req.params.associationId)) {
      return res.status(403).json({ error: "Access denied" });
    }
    res.json(await storage.listDocuments(req.params.associationId));
  });

  app.post("/api/documents/:associationId", requireAuth, async (req, res) => {
    const user = (req as any).user;
    if (!await storage.canUserAccessAssociation(user.id, req.params.associationId, true)) {
      return res.status(403).json({ error: "Manage permission required" });
    }
    const doc = await storage.createDocument({
      associationId: req.params.associationId,
      title: req.body.title,
      category: req.body.category,
      description: req.body.description || null,
      status: req.body.status || "current",
      effectiveDate: req.body.effectiveDate || null,
      expirationDate: req.body.expirationDate || null,
      retentionYears: req.body.retentionYears || null,
      isPublic: req.body.isPublic ?? false,
      tags: req.body.tags || [],
      createdBy: user.id,
    }, user.id);
    res.status(201).json(doc);
  });

  app.patch("/api/documents/item/:id", requireAuth, async (req, res) => {
    const doc = await storage.getDocument(req.params.id);
    if (!doc) return res.status(404).json({ error: "Not found" });
    const user = (req as any).user;
    if (!await storage.canUserAccessAssociation(user.id, doc.associationId, true)) {
      return res.status(403).json({ error: "Manage permission required" });
    }
    const updated = await storage.updateDocument(req.params.id, req.body);
    res.json(updated);
  });

  app.delete("/api/documents/item/:id", requireAuth, async (req, res) => {
    const doc = await storage.getDocument(req.params.id);
    if (!doc) return res.status(404).json({ error: "Not found" });
    const user = (req as any).user;
    if (!await storage.canUserAccessAssociation(user.id, doc.associationId, true)) {
      return res.status(403).json({ error: "Manage permission required" });
    }
    if (doc.filename) {
      const filePath = path.join(uploadDir, doc.filename);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
    await storage.deleteDocument(req.params.id);
    res.json({ ok: true });
  });

  // Document file upload
  app.post("/api/documents/:id/file", requireAuth, upload.single("file"), async (req, res) => {
    const doc = await storage.getDocument(req.params.id);
    if (!doc) return res.status(404).json({ error: "Document not found" });
    const user = (req as any).user;
    if (!await storage.canUserAccessAssociation(user.id, doc.associationId, true)) {
      return res.status(403).json({ error: "Manage permission required" });
    }
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });
    if (doc.filename) {
      const old = path.join(uploadDir, doc.filename);
      if (fs.existsSync(old)) fs.unlinkSync(old);
    }
    await storage.setDocumentFile(req.params.id, req.file.filename);
    await storage.updateDocument(req.params.id, { fileSize: req.file.size });
    res.json({ filename: req.file.filename });
  });

  // ══════════════════════════════════════════════
  // ── CINC API Integration ──
  // ══════════════════════════════════════════════

  const CINC_ENDPOINTS = {
    uat: {
      tokenUrl: "https://identityserver.cincsys.io/connect/token",
      apiBase: "https://integration.cincsys.io/api",
    },
    production: {
      tokenUrl: "https://identity.cincsys.com/connect/token",
      apiBase: "https://vinemgmt.cincsys.com/api",
    },
  };

  async function getCincToken(clientId: string, clientSecret: string, env: "uat" | "production", scope: string) {
    const { tokenUrl } = CINC_ENDPOINTS[env];
    const body = new URLSearchParams({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
      scope,
    });
    const resp = await fetch(tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`Token request failed (${resp.status}): ${text}`);
    }
    const data = await resp.json() as any;
    return data.access_token as string;
  }

  async function cincApiGet(token: string, env: "uat" | "production", path: string) {
    const { apiBase } = CINC_ENDPOINTS[env];
    const resp = await fetch(`${apiBase}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`API call failed (${resp.status}): ${text.slice(0, 200)}`);
    }
    return resp.json();
  }

  app.get("/api/cinc/settings", requireAuth, requireSuperAdmin, async (_req, res) => {
    const settings = await storage.getCincSettings();
    // Never send the full secret to the frontend
    res.json({
      ...settings,
      clientSecret: settings.clientSecret ? "****" + settings.clientSecret.slice(-4) : "",
    });
  });

  app.patch("/api/cinc/settings", requireAuth, requireSuperAdmin, async (req, res) => {
    // Don't overwrite secret with masked version
    const data = { ...req.body };
    if (data.clientSecret && data.clientSecret.startsWith("****")) {
      delete data.clientSecret;
    }
    const updated = await storage.updateCincSettings(data);
    res.json({
      ...updated,
      clientSecret: updated.clientSecret ? "****" + updated.clientSecret.slice(-4) : "",
    });
  });

  // Test connection to CINC API
  app.post("/api/cinc/test", requireAuth, requireSuperAdmin, async (req, res) => {
    try {
      const settings = await storage.getCincSettings();
      const clientId = req.body.clientId || settings.clientId;
      const clientSecret = req.body.clientSecret?.startsWith("****") ? settings.clientSecret : (req.body.clientSecret || settings.clientSecret);
      const env = (req.body.environment || settings.environment) as "uat" | "production";
      const scope = req.body.scope || settings.scope || "cincapi.all";

      if (!clientId || !clientSecret) {
        return res.status(400).json({ error: "Client ID and Secret are required" });
      }

      const token = await getCincToken(clientId, clientSecret, env, scope);
      const associations = await cincApiGet(token, env, "/management/1/Associations") as any[];
      const activeCount = associations.filter((a: any) => a.isActive).length;

      // Save credentials if test passes
      await storage.updateCincSettings({ clientId, clientSecret, environment: env, scope });
      await storage.addCincSyncLog(`Connection test successful (${env}): ${associations.length} associations found (${activeCount} active)`, "success");

      res.json({
        success: true,
        environment: env,
        totalAssociations: associations.length,
        activeAssociations: activeCount,
        associations: associations.slice(0, 10).map((a: any) => ({
          id: a.AssocId,
          code: a.AssociationIdLink,
          name: a.Associationname,
          units: a.Numberofunits,
          active: a.isActive,
          city: a.City,
          state: a.State,
        })),
      });
    } catch (err: any) {
      await storage.addCincSyncLog(`Connection test failed: ${err.message}`, "error");
      res.status(400).json({ error: err.message });
    }
  });

  // Real sync with CINC API
  app.post("/api/cinc/sync", requireAuth, requireSuperAdmin, async (_req, res) => {
    const settings = await storage.getCincSettings();
    if (!settings.clientId || !settings.clientSecret) {
      return res.status(400).json({ error: "CINC credentials not configured" });
    }

    await storage.updateCincSettings({ syncStatus: "syncing" });
    await storage.addCincSyncLog("Starting sync with CINC API...", "info");
    res.json({ message: "Sync started" });

    try {
      const token = await getCincToken(settings.clientId, settings.clientSecret, settings.environment, settings.scope);
      await storage.addCincSyncLog(`Authenticated with CINC ${settings.environment.toUpperCase()} server`, "info");

      // Fetch associations
      const associations = await cincApiGet(token, settings.environment, "/management/1/Associations") as any[];
      const activeAssocs = associations.filter((a: any) => a.isActive);
      await storage.addCincSyncLog(`Found ${associations.length} associations (${activeAssocs.length} active)`, "success");

      // Fetch vendors for first active association
      let vendorCount = 0;
      let workOrderCount = 0;
      if (activeAssocs.length > 0) {
        const firstAssocId = activeAssocs[0].AssocId;
        try {
          const vendors = await cincApiGet(token, settings.environment, `/management/1/Vendors?AssocId=${firstAssocId}`) as any[];
          vendorCount = vendors.length;
          await storage.addCincSyncLog(`Found ${vendors.length} vendors for ${activeAssocs[0].Associationname}`, "success");
        } catch {
          await storage.addCincSyncLog("Vendors endpoint not available", "info");
        }

        try {
          const workOrders = await cincApiGet(token, settings.environment, `/management/1/WorkOrders?AssocId=${firstAssocId}`) as any[];
          workOrderCount = workOrders.length;
          await storage.addCincSyncLog(`Found ${workOrders.length} work orders for ${activeAssocs[0].Associationname}`, "success");
        } catch {
          await storage.addCincSyncLog("Work Orders endpoint not available", "info");
        }
      }

      await storage.addCincSyncLog("Sync completed successfully", "success");
      await storage.updateCincSettings({
        syncStatus: "success",
        lastSyncAt: new Date().toISOString(),
        lastSyncData: {
          associations: associations.length,
          vendors: vendorCount,
          workOrders: workOrderCount,
        },
      });
    } catch (err: any) {
      await storage.addCincSyncLog(`Sync failed: ${err.message}`, "error");
      await storage.updateCincSettings({ syncStatus: "error" });
    }
  });

  // Get sync log
  app.get("/api/cinc/sync-log", requireAuth, requireSuperAdmin, async (_req, res) => {
    const settings = await storage.getCincSettings();
    res.json({
      status: settings.syncStatus,
      lastSyncAt: settings.lastSyncAt,
      lastSyncData: settings.lastSyncData,
      log: settings.syncLog,
    });
  });

  // ══════════════════════════════════════════════
  // ── Public Embed API ──
  // ══════════════════════════════════════════════

  app.get("/api/public/:slug/notices", async (req, res) => {
    const assoc = await storage.getAssociationBySlug(req.params.slug);
    if (!assoc) return res.status(404).json({ error: "Association not found" });
    const notices = await storage.listNotices(assoc.id).map((n) => ({
      id: n.id,
      date: n.date,
      title: n.title,
      type: n.type,
      description: n.description,
      pdfUrl: n.pdfFilename ? `/api/uploads/${n.pdfFilename}` : undefined,
      meetingUrl: n.meetingUrl || undefined,
      postedDate: n.postedDate,
    }));
    res.json({ association: { name: assoc.name, slug: assoc.slug, primaryColor: assoc.primaryColor, accentColor: assoc.accentColor, darkColor: assoc.darkColor }, notices });
  });

  app.get("/api/public/:slug/meetings", async (req, res) => {
    const assoc = await storage.getAssociationBySlug(req.params.slug);
    if (!assoc) return res.status(404).json({ error: "Association not found" });
    const meetings = await storage.listMeetings(assoc.id).map((m) => ({
      id: m.id,
      date: m.date,
      title: m.title,
      description: m.description,
      videoUrl: m.videoUrl || undefined,
      agendaUrl: m.agendaUrl || undefined,
      minutesUrl: m.minutesUrl || undefined,
      createdAt: m.createdAt,
    }));
    res.json({ association: { name: assoc.name, slug: assoc.slug, primaryColor: assoc.primaryColor, accentColor: assoc.accentColor, darkColor: assoc.darkColor }, meetings });
  });

  // Public documents API (for custom websites)
  app.get("/api/public/:slug/documents", async (req, res) => {
    const assoc = await storage.getAssociationBySlug(req.params.slug);
    if (!assoc) return res.status(404).json({ error: "Association not found" });
    const docs = await storage.listDocuments(assoc.id)
      .filter((d) => d.isPublic && d.status === "current")
      .map((d) => ({
        id: d.id,
        title: d.title,
        category: d.category,
        description: d.description,
        effectiveDate: d.effectiveDate,
        fileUrl: d.filename ? `/api/uploads/${d.filename}` : undefined,
        tags: d.tags,
        updatedAt: d.updatedAt,
      }));
    const categories = FLORIDA_DOCUMENT_CATEGORIES.map((c) => ({
      id: c.id,
      label: c.label,
      count: docs.filter((d) => d.category === c.id).length,
    })).filter((c) => c.count > 0);
    res.json({
      association: { name: assoc.name, slug: assoc.slug, primaryColor: assoc.primaryColor, accentColor: assoc.accentColor, darkColor: assoc.darkColor },
      categories,
      documents: docs,
    });
  });

  // ══════════════════════════════════════════════
  // ── CINC Associations (public) ──
  // ══════════════════════════════════════════════

  app.get("/api/cinc/associations", async (req, res) => {
    try {
      const settings = await storage.getCincSettings();
      if (!settings?.clientId || !settings?.clientSecret) {
        return res.json([]);
      }
      const token = await getCincToken(settings.clientId, settings.clientSecret, settings.environment, settings.scope);
      const associations = await cincApiGet(token, settings.environment, "/management/1/Associations") as any[];
      res.json(associations.filter((a: any) => a.isActive !== false));
    } catch (e: any) {
      res.json([]);
    }
  });

  // ══════════════════════════════════════════════
  // ── AI Meeting Notices ──
  // ══════════════════════════════════════════════

  app.get("/api/meeting-notices", async (req, res) => {
    const assocCode = req.query.assocCode as string;
    const list = assocCode ? meetingNoticesStore.filter(n => n.associationCode === assocCode) : meetingNoticesStore;
    res.json(list);
  });
  app.post("/api/meeting-notices", async (req, res) => {
    meetingNoticesStore.push(req.body);
    res.status(201).json(req.body);
  });
  app.patch("/api/meeting-notices/:id", async (req, res) => {
    const idx = meetingNoticesStore.findIndex(n => n.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: "Not found" });
    Object.assign(meetingNoticesStore[idx], req.body);
    res.json(meetingNoticesStore[idx]);
  });
  app.delete("/api/meeting-notices/:id", async (req, res) => {
    const idx = meetingNoticesStore.findIndex(n => n.id === req.params.id);
    if (idx !== -1) meetingNoticesStore.splice(idx, 1);
    res.json({ ok: true });
  });

  // ══════════════════════════════════════════════
  // ── AI Meeting Minutes ──
  // ══════════════════════════════════════════════

  app.get("/api/meeting-minutes", async (req, res) => {
    const assocCode = req.query.assocCode as string;
    const list = assocCode ? meetingMinutesStore.filter(m => m.associationCode === assocCode) : meetingMinutesStore;
    res.json(list);
  });
  app.post("/api/meeting-minutes", async (req, res) => {
    meetingMinutesStore.push(req.body);
    res.status(201).json(req.body);
  });
  app.patch("/api/meeting-minutes/:id", async (req, res) => {
    const idx = meetingMinutesStore.findIndex(m => m.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: "Not found" });
    Object.assign(meetingMinutesStore[idx], req.body);
    res.json(meetingMinutesStore[idx]);
  });
  app.delete("/api/meeting-minutes/:id", async (req, res) => {
    const idx = meetingMinutesStore.findIndex(m => m.id === req.params.id);
    if (idx !== -1) meetingMinutesStore.splice(idx, 1);
    res.json({ ok: true });
  });

  // ══════════════════════════════════════════════
  // ── Push notice to CINC ──
  // ══════════════════════════════════════════════

  app.post("/api/cinc/push-meeting-notice", async (req, res) => {
    try {
      const { assocCode, type, content, meetingDate } = req.body;
      // For now, just log/acknowledge — full CINC correspondence write requires production endpoint
      res.json({ ok: true, message: `Notice for ${assocCode} queued for CINC push` });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ══════════════════════════════════════════════
  // ── PUBLIC — JSON Feed for meetings ──
  // ══════════════════════════════════════════════

  app.get("/api/public/meetings/:assocCode/feed.json", async (req, res) => {
    const code = req.params.assocCode;
    const notices = meetingNoticesStore.filter(n => n.associationCode === code && ["approved", "sent", "published"].includes(n.status));
    const minutes = meetingMinutesStore.filter(m => m.associationCode === code && ["approved", "filed", "published"].includes(m.status));
    res.json({
      association: code,
      generatedAt: new Date().toISOString(),
      upcomingMeetings: notices.map(n => ({
        id: n.id, type: n.type, meetingType: n.meetingType,
        date: n.meetingDate, time: n.meetingTime,
        location: n.location, virtualUrl: n.virtualUrl,
        status: n.status, content: n.content,
      })),
      approvedMinutes: minutes.map(m => ({
        id: m.id, type: m.type, date: m.meetingDate,
        time: m.meetingTime, location: m.location,
        status: m.status, motionCount: m.motions?.length || 0,
        actionItemCount: m.actionItems?.length || 0,
        content: m.content,
      })),
    });
  });

  // ══════════════════════════════════════════════
  // ── PUBLIC — Embeddable HTML page ──
  // ══════════════════════════════════════════════

  app.get("/api/public/meetings/:assocCode/embed", async (req, res) => {
    const code = req.params.assocCode;
    const notices = meetingNoticesStore.filter(n => n.associationCode === code && ["approved", "sent", "published"].includes(n.status));
    const minutes = meetingMinutesStore.filter(m => m.associationCode === code && ["approved", "filed", "published"].includes(m.status));
    const assocName = notices[0]?.associationName || minutes[0]?.associationName || code;

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Meetings — ${assocName}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Source Sans 3',system-ui,sans-serif;background:#FAFAF5;color:#494E4B;line-height:1.6;padding:24px;max-width:800px;margin:0 auto}
h1{font-family:'DM Serif Display',Georgia,serif;color:#1B3E1E;font-size:1.4rem;margin-bottom:4px}
.sub{color:#7A7E7B;font-size:.85rem;margin-bottom:24px}
.section{margin-bottom:32px}
.section-title{font-family:'DM Serif Display',Georgia,serif;color:#317C3C;font-size:1.1rem;border-bottom:2px solid #317C3C;padding-bottom:6px;margin-bottom:16px}
.card{background:#fff;border:1px solid #E0E0D8;border-radius:8px;padding:16px;margin-bottom:12px}
.card-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px}
.badge{display:inline-block;padding:2px 8px;border-radius:4px;font-size:.7rem;font-weight:600;text-transform:uppercase}
.badge-board{background:#E8F5E9;color:#1B3E1E}.badge-annual{background:#E3F2FD;color:#1565C0}
.meta{font-size:.8rem;color:#7A7E7B}
pre{white-space:pre-wrap;font-family:'Times New Roman',serif;font-size:.85rem;line-height:1.5;background:#FAFAF5;border:1px solid #E0E0D8;border-radius:6px;padding:12px;margin-top:8px;max-height:300px;overflow-y:auto}
.empty{text-align:center;padding:40px;color:#A0A4A1;font-size:.9rem}
.toggle{cursor:pointer;color:#317C3C;font-size:.8rem;text-decoration:underline}
.vine{text-align:center;margin-top:24px;font-size:.75rem;color:#A0A4A1}
.vine a{color:#317C3C;text-decoration:none}
</style>
<link href="https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=Source+Sans+3:wght@400;600&display=swap" rel="stylesheet">
</head>
<body>
<h1>${assocName}</h1>
<p class="sub">Meeting Notices & Minutes</p>

<div class="section">
<h2 class="section-title">Upcoming Meetings</h2>
${notices.length > 0 ? notices.map(n => `<div class="card">
<div class="card-header"><span class="badge badge-${n.type}">${n.type} Meeting</span><span class="meta">${n.meetingDate || ''}</span></div>
<p><strong>${n.meetingTime || ''}</strong> — ${n.location || ''}</p>
${n.virtualUrl ? '<p class="meta">Virtual: ' + n.virtualUrl + '</p>' : ''}
<details><summary class="toggle">View Full Notice</summary><pre>${(n.content || '').replace(/</g,'&lt;')}</pre></details>
</div>`).join('\n') : '<p class="empty">No upcoming meetings posted</p>'}
</div>

<div class="section">
<h2 class="section-title">Approved Minutes</h2>
${minutes.length > 0 ? minutes.map(m => `<div class="card">
<div class="card-header"><span class="badge badge-${m.type}">${m.type} Meeting</span><span class="meta">${m.meetingDate || ''}</span></div>
<p class="meta">${m.motions?.length || 0} motions · ${m.actionItems?.length || 0} action items</p>
<details><summary class="toggle">View Full Minutes</summary><pre>${(m.content || '').replace(/</g,'&lt;')}</pre></details>
</div>`).join('\n') : '<p class="empty">No approved minutes posted</p>'}
</div>

<p class="vine">Managed by <a href="https://vinemgt.com" target="_blank">Vine Management Group</a></p>
</body></html>`;
    res.setHeader("Content-Type", "text/html");
    res.setHeader("X-Frame-Options", "ALLOWALL");
    res.send(html);
  });

  return httpServer;
}
