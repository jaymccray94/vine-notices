import { Router } from "express";
import { storage } from "../storage";
import { insertAssociationSchema } from "@shared/schema";
import { requireAuth, requireSuperAdmin } from "../middleware/auth";

const router = Router();

router.get("/api/associations", requireAuth, async (req, res) => {
  const user = req.user!;
  let associations = await storage.listAssociations();
  if (user.role !== "super_admin") {
    const userAssocs = await storage.getUserAssociations(user.userId);
    const ids = new Set(userAssocs.map((ua) => ua.associationId));
    associations = associations.filter((a) => ids.has(a.id));
  }
  res.json(associations);
});

router.post("/api/associations", requireAuth, requireSuperAdmin, async (req, res) => {
  const parsed = insertAssociationSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  if (await storage.getAssociationBySlug(parsed.data.slug)) {
    return res.status(409).json({ error: "An association with this slug already exists" });
  }
  const assoc = await storage.createAssociation(parsed.data);
  res.status(201).json(assoc);
});

router.patch("/api/associations/:id", requireAuth, requireSuperAdmin, async (req, res) => {
  const updated = await storage.updateAssociation(req.params.id, req.body);
  if (!updated) return res.status(404).json({ error: "Not found" });
  res.json(updated);
});

router.delete("/api/associations/:id", requireAuth, requireSuperAdmin, async (req, res) => {
  await storage.deleteAssociation(req.params.id);
  res.json({ ok: true });
});

export default router;
