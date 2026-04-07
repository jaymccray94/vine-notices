import { Router } from "express";
import { storage } from "../storage";
import { insertInsurancePolicySchema } from "@shared/schema";
import { requireAuth } from "../middleware/auth";

const router = Router();

router.get("/api/insurance/:associationId", requireAuth, async (req, res) => {
  const user = req.user!;
  if (!await storage.canUserAccessAssociation(user.userId, req.params.associationId)) {
    return res.status(403).json({ error: "Access denied" });
  }
  res.json(await storage.listInsurancePolicies(req.params.associationId));
});

router.post("/api/insurance/:associationId", requireAuth, async (req, res) => {
  const user = req.user!;
  if (!await storage.canUserAccessAssociation(user.userId, req.params.associationId, true)) {
    return res.status(403).json({ error: "Manage permission required" });
  }
  const parsed = insertInsurancePolicySchema.safeParse({ ...req.body, associationId: req.params.associationId });
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const policy = await storage.createInsurancePolicy(parsed.data, user.userId);
  res.status(201).json(policy);
});

router.patch("/api/insurance/item/:id", requireAuth, async (req, res) => {
  const policy = await storage.getInsurancePolicy(req.params.id);
  if (!policy) return res.status(404).json({ error: "Not found" });
  const user = req.user!;
  if (!await storage.canUserAccessAssociation(user.userId, policy.associationId, true)) {
    return res.status(403).json({ error: "Manage permission required" });
  }
  const updated = await storage.updateInsurancePolicy(req.params.id, req.body);
  res.json(updated);
});

router.delete("/api/insurance/item/:id", requireAuth, async (req, res) => {
  const policy = await storage.getInsurancePolicy(req.params.id);
  if (!policy) return res.status(404).json({ error: "Not found" });
  const user = req.user!;
  if (!await storage.canUserAccessAssociation(user.userId, policy.associationId, true)) {
    return res.status(403).json({ error: "Manage permission required" });
  }
  await storage.deleteInsurancePolicy(req.params.id);
  res.json({ ok: true });
});

export default router;
