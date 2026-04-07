import { Router } from "express";
import fs from "fs";
import { storage } from "../storage";
import { insertNoticeSchema } from "@shared/schema";
import { requireAuth } from "../middleware/auth";
import { upload, uploadDir, safeUploadPath, deleteUploadedFile } from "./upload";

const router = Router();

router.get("/api/associations/:assocId/notices", requireAuth, async (req, res) => {
  const user = req.user!;
  if (!await storage.canUserAccessAssociation(user.userId, req.params.assocId)) {
    return res.status(403).json({ error: "Access denied" });
  }
  res.json(await storage.listNotices(req.params.assocId));
});

router.post("/api/associations/:assocId/notices", requireAuth, async (req, res) => {
  const user = req.user!;
  if (!await storage.canUserAccessAssociation(user.userId, req.params.assocId, true)) {
    return res.status(403).json({ error: "Manage permission required" });
  }
  const parsed = insertNoticeSchema.safeParse({ ...req.body, associationId: req.params.assocId });
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const notice = await storage.createNotice(parsed.data, user.userId);
  res.status(201).json(notice);
});

router.patch("/api/notices/:id", requireAuth, async (req, res) => {
  const notice = await storage.getNotice(req.params.id);
  if (!notice) return res.status(404).json({ error: "Not found" });
  const user = req.user!;
  if (!await storage.canUserAccessAssociation(user.userId, notice.associationId, true)) {
    return res.status(403).json({ error: "Manage permission required" });
  }
  const updated = await storage.updateNotice(req.params.id, req.body);
  res.json(updated);
});

router.delete("/api/notices/:id", requireAuth, async (req, res) => {
  const notice = await storage.getNotice(req.params.id);
  if (!notice) return res.status(404).json({ error: "Not found" });
  const user = req.user!;
  if (!await storage.canUserAccessAssociation(user.userId, notice.associationId, true)) {
    return res.status(403).json({ error: "Manage permission required" });
  }
  if (notice.pdfFilename) {
    deleteUploadedFile(notice.pdfFilename);
  }
  await storage.deleteNotice(req.params.id);
  res.json({ ok: true });
});

// ── PDF Upload ──
router.post("/api/notices/:id/pdf", requireAuth, upload.single("pdf"), async (req, res) => {
  const notice = await storage.getNotice(req.params.id);
  if (!notice) return res.status(404).json({ error: "Notice not found" });
  const user = req.user!;
  if (!await storage.canUserAccessAssociation(user.userId, notice.associationId, true)) {
    return res.status(403).json({ error: "Manage permission required" });
  }
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });
  if (notice.pdfFilename) {
    deleteUploadedFile(notice.pdfFilename);
  }
  await storage.setNoticePdf(req.params.id, req.file.filename);
  res.json({ filename: req.file.filename });
});

router.delete("/api/notices/:id/pdf", requireAuth, async (req, res) => {
  const notice = await storage.getNotice(req.params.id);
  if (!notice) return res.status(404).json({ error: "Not found" });
  const user = req.user!;
  if (!await storage.canUserAccessAssociation(user.userId, notice.associationId, true)) {
    return res.status(403).json({ error: "Manage permission required" });
  }
  if (notice.pdfFilename) {
    deleteUploadedFile(notice.pdfFilename);
  }
  await storage.setNoticePdf(req.params.id, null);
  res.json({ ok: true });
});

// ── File download (with path traversal protection) ──
router.get("/api/uploads/:filename", async (req, res) => {
  const filePath = safeUploadPath(req.params.filename);
  if (!filePath) return res.status(400).json({ error: "Invalid filename" });
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: "File not found" });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `inline; filename="${req.params.filename}"`);
  fs.createReadStream(filePath).pipe(res);
});

export default router;
