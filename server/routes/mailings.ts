import { Router } from "express";
import { storage } from "../storage";
import { insertMailingRequestSchema } from "@shared/schema";
import { requireAuth } from "../middleware/auth";

const router = Router();

router.get("/api/mailings/:associationId", requireAuth, async (req, res) => {
  const user = req.user!;
  if (!await storage.canUserAccessAssociation(user.userId, req.params.associationId)) {
    return res.status(403).json({ error: "Access denied" });
  }
  res.json(await storage.listMailingRequests(req.params.associationId));
});

router.post("/api/mailings/:associationId", requireAuth, async (req, res) => {
  const user = req.user!;
  if (!await storage.canUserAccessAssociation(user.userId, req.params.associationId, true)) {
    return res.status(403).json({ error: "Manage permission required" });
  }
  const parsed = insertMailingRequestSchema.safeParse({ ...req.body, associationId: req.params.associationId });
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const mailing = await storage.createMailingRequest(parsed.data, user.userId);
  res.status(201).json(mailing);
});

router.patch("/api/mailings/item/:id", requireAuth, async (req, res) => {
  const mailing = await storage.getMailingRequest(req.params.id);
  if (!mailing) return res.status(404).json({ error: "Not found" });
  const user = req.user!;
  if (!await storage.canUserAccessAssociation(user.userId, mailing.associationId, true)) {
    return res.status(403).json({ error: "Manage permission required" });
  }
  const updated = await storage.updateMailingRequest(req.params.id, req.body);
  res.json(updated);
});

router.delete("/api/mailings/item/:id", requireAuth, async (req, res) => {
  const mailing = await storage.getMailingRequest(req.params.id);
  if (!mailing) return res.status(404).json({ error: "Not found" });
  const user = req.user!;
  if (!await storage.canUserAccessAssociation(user.userId, mailing.associationId, true)) {
    return res.status(403).json({ error: "Manage permission required" });
  }
  await storage.deleteMailingRequest(req.params.id);
  res.json({ ok: true });
});

export default router;
