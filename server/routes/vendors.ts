import { Router } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { requireAuth } from "../middleware/auth";

const insertVendorSchema = z.object({
  name: z.string().min(1),
  contactName: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  email: z.string().email().nullable().optional(),
  category: z.string().default("General"),
  status: z.enum(["active", "inactive"]).default("active"),
  insuranceExpiry: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  cincVendorId: z.string().nullable().optional(),
});

const router = Router();

router.get("/api/vendors/:associationId", requireAuth, async (req, res) => {
  const user = req.user!;
  if (!await storage.canUserAccessAssociation(user.userId, req.params.associationId)) {
    return res.status(403).json({ error: "Access denied" });
  }
  res.json(await storage.listVendors(req.params.associationId));
});

router.get("/api/global/vendors", requireAuth, async (req, res) => {
  const user = req.user!;
  let vendors = await storage.listAllVendors();
  if (user.role !== "super_admin") {
    const userAssocs = await storage.getUserAssociations(user.userId);
    const ids = new Set(userAssocs.map((ua) => ua.associationId));
    vendors = vendors.filter((v) => ids.has(v.associationId));
  }
  const enriched = await Promise.all(vendors.map(async (v) => {
    const assoc = await storage.getAssociation(v.associationId);
    return { ...v, associationName: assoc?.name || "Unknown" };
  }));
  res.json(enriched);
});

router.post("/api/vendors/:associationId", requireAuth, async (req, res) => {
  const user = req.user!;
  if (!await storage.canUserAccessAssociation(user.userId, req.params.associationId, true)) {
    return res.status(403).json({ error: "Manage permission required" });
  }
  const parsed = insertVendorSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const vendor = await storage.createVendor({
    associationId: req.params.associationId,
    name: parsed.data.name,
    contactName: parsed.data.contactName ?? null,
    phone: parsed.data.phone ?? null,
    email: parsed.data.email ?? null,
    category: parsed.data.category,
    status: parsed.data.status,
    insuranceExpiry: parsed.data.insuranceExpiry ?? null,
    notes: parsed.data.notes ?? null,
    cincVendorId: parsed.data.cincVendorId ?? null,
    createdBy: user.userId,
    organizationId: user.organizationId,
  }, user.userId);
  res.status(201).json(vendor);
});

router.patch("/api/vendors/item/:id", requireAuth, async (req, res) => {
  const vendor = await storage.getVendor(req.params.id);
  if (!vendor) return res.status(404).json({ error: "Not found" });
  const user = req.user!;
  if (!await storage.canUserAccessAssociation(user.userId, vendor.associationId, true)) {
    return res.status(403).json({ error: "Manage permission required" });
  }
  const updated = await storage.updateVendor(req.params.id, req.body);
  res.json(updated);
});

router.delete("/api/vendors/item/:id", requireAuth, async (req, res) => {
  const vendor = await storage.getVendor(req.params.id);
  if (!vendor) return res.status(404).json({ error: "Not found" });
  const user = req.user!;
  if (!await storage.canUserAccessAssociation(user.userId, vendor.associationId, true)) {
    return res.status(403).json({ error: "Manage permission required" });
  }
  await storage.deleteVendor(req.params.id);
  res.json({ ok: true });
});

export default router;
