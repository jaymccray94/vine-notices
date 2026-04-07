import { Router } from "express";
import { storage } from "../storage";
import { insertTicketSchema } from "@shared/schema";
import { requireAuth } from "../middleware/auth";

const router = Router();

router.get("/api/tickets/:associationId", requireAuth, async (req, res) => {
  const user = req.user!;
  if (!await storage.canUserAccessAssociation(user.userId, req.params.associationId)) {
    return res.status(403).json({ error: "Access denied" });
  }
  res.json(await storage.listTickets(req.params.associationId));
});

router.post("/api/tickets/:associationId", requireAuth, async (req, res) => {
  const user = req.user!;
  if (!await storage.canUserAccessAssociation(user.userId, req.params.associationId, true)) {
    return res.status(403).json({ error: "Manage permission required" });
  }
  const parsed = insertTicketSchema.safeParse({ ...req.body, associationId: req.params.associationId });
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const ticket = await storage.createTicket(parsed.data, user.userId);
  res.status(201).json(ticket);
});

router.patch("/api/tickets/item/:id", requireAuth, async (req, res) => {
  const ticket = await storage.getTicket(req.params.id);
  if (!ticket) return res.status(404).json({ error: "Not found" });
  const user = req.user!;
  if (!await storage.canUserAccessAssociation(user.userId, ticket.associationId, true)) {
    return res.status(403).json({ error: "Manage permission required" });
  }
  const updated = await storage.updateTicket(req.params.id, req.body);
  res.json(updated);
});

router.delete("/api/tickets/item/:id", requireAuth, async (req, res) => {
  const ticket = await storage.getTicket(req.params.id);
  if (!ticket) return res.status(404).json({ error: "Not found" });
  const user = req.user!;
  if (!await storage.canUserAccessAssociation(user.userId, ticket.associationId, true)) {
    return res.status(403).json({ error: "Manage permission required" });
  }
  await storage.deleteTicket(req.params.id);
  res.json({ ok: true });
});

// ── Global Tickets (cross-association) ──
router.get("/api/global/tickets", requireAuth, async (req, res) => {
  const user = req.user!;
  let tickets = await storage.listAllTickets();
  if (user.role !== "super_admin") {
    const userAssocs = await storage.getUserAssociations(user.userId);
    const ids = new Set(userAssocs.map((ua) => ua.associationId));
    tickets = tickets.filter((t) => ids.has(t.associationId));
  }
  const enriched = await Promise.all(tickets.map(async (t) => {
    const assoc = await storage.getAssociation(t.associationId);
    return { ...t, associationName: assoc?.name || "Unknown", associationColor: assoc?.primaryColor || "#6B7280" };
  }));
  res.json(enriched);
});

export default router;
