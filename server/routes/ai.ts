import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";

const router = Router();

// Validation schemas for AI meeting data
const meetingNoticeSchema = z.object({
  id: z.string(),
  associationCode: z.string(),
  associationName: z.string().optional(),
  type: z.string(),
  meetingType: z.string().optional(),
  meetingDate: z.string().optional(),
  meetingTime: z.string().optional(),
  location: z.string().optional(),
  virtualUrl: z.string().optional(),
  status: z.string(),
  content: z.string().optional(),
});

const meetingMinuteSchema = z.object({
  id: z.string(),
  associationCode: z.string(),
  associationName: z.string().optional(),
  type: z.string(),
  meetingDate: z.string().optional(),
  meetingTime: z.string().optional(),
  location: z.string().optional(),
  status: z.string(),
  content: z.string().optional(),
  motions: z.array(z.any()).optional(),
  actionItems: z.array(z.any()).optional(),
});

// Helper to get shared in-memory stores from app.locals
function getNoticesStore(req: any): any[] {
  if (!req.app.locals.meetingNoticesStore) {
    req.app.locals.meetingNoticesStore = [];
  }
  return req.app.locals.meetingNoticesStore;
}

function getMinutesStore(req: any): any[] {
  if (!req.app.locals.meetingMinutesStore) {
    req.app.locals.meetingMinutesStore = [];
  }
  return req.app.locals.meetingMinutesStore;
}

// ── AI Meeting Notices ──
router.get("/api/meeting-notices", async (req, res) => {
  const store = getNoticesStore(req);
  const assocCode = req.query.assocCode as string;
  const list = assocCode ? store.filter((n: any) => n.associationCode === assocCode) : store;
  res.json(list);
});

router.post("/api/meeting-notices", async (req, res) => {
  const parsed = meetingNoticeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const store = getNoticesStore(req);
  store.push(parsed.data);
  res.status(201).json(parsed.data);
});

router.patch("/api/meeting-notices/:id", async (req, res) => {
  const store = getNoticesStore(req);
  const idx = store.findIndex((n: any) => n.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: "Not found" });
  Object.assign(store[idx], req.body);
  res.json(store[idx]);
});

router.delete("/api/meeting-notices/:id", async (req, res) => {
  const store = getNoticesStore(req);
  const idx = store.findIndex((n: any) => n.id === req.params.id);
  if (idx !== -1) store.splice(idx, 1);
  res.json({ ok: true });
});

// ── AI Meeting Minutes ──
router.get("/api/meeting-minutes", async (req, res) => {
  const store = getMinutesStore(req);
  const assocCode = req.query.assocCode as string;
  const list = assocCode ? store.filter((m: any) => m.associationCode === assocCode) : store;
  res.json(list);
});

router.post("/api/meeting-minutes", async (req, res) => {
  const parsed = meetingMinuteSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const store = getMinutesStore(req);
  store.push(parsed.data);
  res.status(201).json(parsed.data);
});

router.patch("/api/meeting-minutes/:id", async (req, res) => {
  const store = getMinutesStore(req);
  const idx = store.findIndex((m: any) => m.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: "Not found" });
  Object.assign(store[idx], req.body);
  res.json(store[idx]);
});

router.delete("/api/meeting-minutes/:id", async (req, res) => {
  const store = getMinutesStore(req);
  const idx = store.findIndex((m: any) => m.id === req.params.id);
  if (idx !== -1) store.splice(idx, 1);
  res.json({ ok: true });
});

export default router;
