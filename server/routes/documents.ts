import { Router } from "express";
import { z } from "zod";
import { storage, FLORIDA_DOCUMENT_CATEGORIES } from "../storage";
import { requireAuth } from "../middleware/auth";
import { upload, deleteUploadedFile } from "./upload";

const insertDocumentSchema = z.object({
  title: z.string().min(1),
  category: z.string().min(1),
  description: z.string().nullable().optional(),
  status: z.enum(["current", "archived"]).default("current"),
  effectiveDate: z.string().nullable().optional(),
  expirationDate: z.string().nullable().optional(),
  retentionYears: z.number().nullable().optional(),
  isPublic: z.boolean().default(false),
  tags: z.array(z.string()).default([]),
});

const router = Router();

router.get("/api/document-categories", requireAuth, async (_req, res) => {
  res.json(FLORIDA_DOCUMENT_CATEGORIES);
});

router.get("/api/documents/:associationId", requireAuth, async (req, res) => {
  const user = req.user!;
  if (!await storage.canUserAccessAssociation(user.userId, req.params.associationId)) {
    return res.status(403).json({ error: "Access denied" });
  }
  res.json(await storage.listDocuments(req.params.associationId));
});

router.post("/api/documents/:associationId", requireAuth, async (req, res) => {
  const user = req.user!;
  if (!await storage.canUserAccessAssociation(user.userId, req.params.associationId, true)) {
    return res.status(403).json({ error: "Manage permission required" });
  }
  const parsed = insertDocumentSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const doc = await storage.createDocument({
    associationId: req.params.associationId,
    title: parsed.data.title,
    category: parsed.data.category,
    description: parsed.data.description ?? null,
    status: parsed.data.status,
    effectiveDate: parsed.data.effectiveDate ?? null,
    expirationDate: parsed.data.expirationDate ?? null,
    retentionYears: parsed.data.retentionYears ?? null,
    isPublic: parsed.data.isPublic,
    tags: parsed.data.tags,
    createdBy: user.userId,
  }, user.userId);
  res.status(201).json(doc);
});

router.patch("/api/documents/item/:id", requireAuth, async (req, res) => {
  const doc = await storage.getDocument(req.params.id);
  if (!doc) return res.status(404).json({ error: "Not found" });
  const user = req.user!;
  if (!await storage.canUserAccessAssociation(user.userId, doc.associationId, true)) {
    return res.status(403).json({ error: "Manage permission required" });
  }
  const updated = await storage.updateDocument(req.params.id, req.body);
  res.json(updated);
});

router.delete("/api/documents/item/:id", requireAuth, async (req, res) => {
  const doc = await storage.getDocument(req.params.id);
  if (!doc) return res.status(404).json({ error: "Not found" });
  const user = req.user!;
  if (!await storage.canUserAccessAssociation(user.userId, doc.associationId, true)) {
    return res.status(403).json({ error: "Manage permission required" });
  }
  if (doc.filename) {
    deleteUploadedFile(doc.filename);
  }
  await storage.deleteDocument(req.params.id);
  res.json({ ok: true });
});

router.post("/api/documents/:id/file", requireAuth, upload.single("file"), async (req, res) => {
  const doc = await storage.getDocument(req.params.id);
  if (!doc) return res.status(404).json({ error: "Document not found" });
  const user = req.user!;
  if (!await storage.canUserAccessAssociation(user.userId, doc.associationId, true)) {
    return res.status(403).json({ error: "Manage permission required" });
  }
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });
  if (doc.filename) {
    deleteUploadedFile(doc.filename);
  }
  await storage.setDocumentFile(req.params.id, req.file.filename);
  await storage.updateDocument(req.params.id, { fileSize: req.file.size });
  res.json({ filename: req.file.filename });
});

export default router;
