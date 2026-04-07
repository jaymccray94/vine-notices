import { Router } from "express";
import { storage } from "../storage";
import { insertMeetingSchema } from "@shared/schema";
import { requireAuth } from "../middleware/auth";

const router = Router();

router.get("/api/associations/:assocId/meetings", requireAuth, async (req, res) => {
  const user = req.user!;
  if (!await storage.canUserAccessAssociation(user.userId, req.params.assocId)) {
    return res.status(403).json({ error: "Access denied" });
  }
  res.json(await storage.listMeetings(req.params.assocId));
});

router.post("/api/associations/:assocId/meetings", requireAuth, async (req, res) => {
  const user = req.user!;
  if (!await storage.canUserAccessAssociation(user.userId, req.params.assocId, true)) {
    return res.status(403).json({ error: "Manage permission required" });
  }
  const parsed = insertMeetingSchema.safeParse({ ...req.body, associationId: req.params.assocId });
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const meeting = await storage.createMeeting(parsed.data, user.userId);
  res.status(201).json(meeting);
});

router.patch("/api/meetings/:id", requireAuth, async (req, res) => {
  const meeting = await storage.getMeeting(req.params.id);
  if (!meeting) return res.status(404).json({ error: "Not found" });
  const user = req.user!;
  if (!await storage.canUserAccessAssociation(user.userId, meeting.associationId, true)) {
    return res.status(403).json({ error: "Manage permission required" });
  }
  const updated = await storage.updateMeeting(req.params.id, req.body);
  res.json(updated);
});

router.delete("/api/meetings/:id", requireAuth, async (req, res) => {
  const meeting = await storage.getMeeting(req.params.id);
  if (!meeting) return res.status(404).json({ error: "Not found" });
  const user = req.user!;
  if (!await storage.canUserAccessAssociation(user.userId, meeting.associationId, true)) {
    return res.status(403).json({ error: "Manage permission required" });
  }
  await storage.deleteMeeting(req.params.id);
  res.json({ ok: true });
});

export default router;
