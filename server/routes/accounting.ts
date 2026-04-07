import { Router } from "express";
import { storage } from "../storage";
import { insertAccountingItemSchema } from "@shared/schema";
import { requireAuth } from "../middleware/auth";

const router = Router();

router.get("/api/accounting/:associationId", requireAuth, async (req, res) => {
  const user = req.user!;
  if (!await storage.canUserAccessAssociation(user.userId, req.params.associationId)) {
    return res.status(403).json({ error: "Access denied" });
  }
  res.json(await storage.listAccountingItems(req.params.associationId));
});

router.post("/api/accounting/:associationId", requireAuth, async (req, res) => {
  const user = req.user!;
  if (!await storage.canUserAccessAssociation(user.userId, req.params.associationId, true)) {
    return res.status(403).json({ error: "Manage permission required" });
  }
  const parsed = insertAccountingItemSchema.safeParse({ ...req.body, associationId: req.params.associationId });
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const item = await storage.createAccountingItem(parsed.data, user.userId);
  res.status(201).json(item);
});

router.patch("/api/accounting/item/:id", requireAuth, async (req, res) => {
  const item = await storage.getAccountingItem(req.params.id);
  if (!item) return res.status(404).json({ error: "Not found" });
  const user = req.user!;
  if (!await storage.canUserAccessAssociation(user.userId, item.associationId, true)) {
    return res.status(403).json({ error: "Manage permission required" });
  }
  const updated = await storage.updateAccountingItem(req.params.id, req.body);
  res.json(updated);
});

router.delete("/api/accounting/item/:id", requireAuth, async (req, res) => {
  const item = await storage.getAccountingItem(req.params.id);
  if (!item) return res.status(404).json({ error: "Not found" });
  const user = req.user!;
  if (!await storage.canUserAccessAssociation(user.userId, item.associationId, true)) {
    return res.status(403).json({ error: "Manage permission required" });
  }
  await storage.deleteAccountingItem(req.params.id);
  res.json({ ok: true });
});

export default router;
