import { Router } from "express";
import { storage } from "../storage";
import { insertInvoiceSchema } from "@shared/schema";
import { requireAuth } from "../middleware/auth";

const router = Router();

router.get("/api/invoices/:associationId", requireAuth, async (req, res) => {
  const user = req.user!;
  if (!await storage.canUserAccessAssociation(user.userId, req.params.associationId)) {
    return res.status(403).json({ error: "Access denied" });
  }
  res.json(await storage.listInvoices(req.params.associationId));
});

router.post("/api/invoices/:associationId", requireAuth, async (req, res) => {
  const user = req.user!;
  if (!await storage.canUserAccessAssociation(user.userId, req.params.associationId, true)) {
    return res.status(403).json({ error: "Manage permission required" });
  }
  const parsed = insertInvoiceSchema.safeParse({ ...req.body, associationId: req.params.associationId });
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const invoice = await storage.createInvoice(parsed.data, user.userId);
  res.status(201).json(invoice);
});

router.patch("/api/invoices/item/:id", requireAuth, async (req, res) => {
  const invoice = await storage.getInvoice(req.params.id);
  if (!invoice) return res.status(404).json({ error: "Not found" });
  const user = req.user!;
  if (!await storage.canUserAccessAssociation(user.userId, invoice.associationId, true)) {
    return res.status(403).json({ error: "Manage permission required" });
  }
  const updated = await storage.updateInvoice(req.params.id, req.body);
  res.json(updated);
});

router.delete("/api/invoices/item/:id", requireAuth, async (req, res) => {
  const invoice = await storage.getInvoice(req.params.id);
  if (!invoice) return res.status(404).json({ error: "Not found" });
  const user = req.user!;
  if (!await storage.canUserAccessAssociation(user.userId, invoice.associationId, true)) {
    return res.status(403).json({ error: "Manage permission required" });
  }
  await storage.deleteInvoice(req.params.id);
  res.json({ ok: true });
});

export default router;
