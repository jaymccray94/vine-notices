import { Router } from "express";
import { storage } from "../storage";
import { insertOnboardingChecklistSchema } from "@shared/schema";
import { requireAuth } from "../middleware/auth";

const router = Router();

router.get("/api/onboarding/:associationId", requireAuth, async (req, res) => {
  const user = req.user!;
  if (!await storage.canUserAccessAssociation(user.userId, req.params.associationId)) {
    return res.status(403).json({ error: "Access denied" });
  }
  res.json(await storage.listOnboardingChecklists(req.params.associationId));
});

router.post("/api/onboarding/:associationId", requireAuth, async (req, res) => {
  const user = req.user!;
  if (!await storage.canUserAccessAssociation(user.userId, req.params.associationId, true)) {
    return res.status(403).json({ error: "Manage permission required" });
  }
  const parsed = insertOnboardingChecklistSchema.safeParse({ ...req.body, associationId: req.params.associationId });
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const checklist = await storage.createOnboardingChecklist(parsed.data, user.userId);
  res.status(201).json(checklist);
});

router.patch("/api/onboarding/item/:id", requireAuth, async (req, res) => {
  const checklist = await storage.getOnboardingChecklist(req.params.id);
  if (!checklist) return res.status(404).json({ error: "Not found" });
  const user = req.user!;
  if (!await storage.canUserAccessAssociation(user.userId, checklist.associationId, true)) {
    return res.status(403).json({ error: "Manage permission required" });
  }
  const updated = await storage.updateOnboardingChecklist(req.params.id, req.body);
  res.json(updated);
});

router.delete("/api/onboarding/item/:id", requireAuth, async (req, res) => {
  const checklist = await storage.getOnboardingChecklist(req.params.id);
  if (!checklist) return res.status(404).json({ error: "Not found" });
  const user = req.user!;
  if (!await storage.canUserAccessAssociation(user.userId, checklist.associationId, true)) {
    return res.status(403).json({ error: "Manage permission required" });
  }
  await storage.deleteOnboardingChecklist(req.params.id);
  res.json({ ok: true });
});

router.patch("/api/onboarding/item/:checklistId/toggle/:itemId", requireAuth, async (req, res) => {
  const checklist = await storage.getOnboardingChecklist(req.params.checklistId);
  if (!checklist) return res.status(404).json({ error: "Not found" });
  const user = req.user!;
  if (!await storage.canUserAccessAssociation(user.userId, checklist.associationId, true)) {
    return res.status(403).json({ error: "Manage permission required" });
  }
  const updated = await storage.toggleOnboardingItem(req.params.checklistId, req.params.itemId);
  if (!updated) return res.status(404).json({ error: "Item not found" });
  res.json(updated);
});

export default router;
