import { Router } from "express";
import { storage } from "../storage";
import { insertUserSchema } from "@shared/schema";
import { requireAuth, requireSuperAdmin } from "../middleware/auth";

const router = Router();

router.get("/api/users", requireAuth, requireSuperAdmin, async (_req, res) => {
  res.json(await storage.listUsers());
});

router.post("/api/users", requireAuth, requireSuperAdmin, async (req, res) => {
  const parsed = insertUserSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  if (await storage.getUserByEmail(parsed.data.email)) {
    return res.status(409).json({ error: "A user with this email already exists" });
  }
  const user = await storage.createUser(parsed.data);
  res.status(201).json(user);
});

router.patch("/api/users/:id", requireAuth, requireSuperAdmin, async (req, res) => {
  const updated = await storage.updateUser(req.params.id, req.body);
  if (!updated) return res.status(404).json({ error: "Not found" });
  res.json(updated);
});

router.delete("/api/users/:id", requireAuth, requireSuperAdmin, async (req, res) => {
  await storage.deleteUser(req.params.id);
  res.json({ ok: true });
});

router.put("/api/users/:id/associations", requireAuth, requireSuperAdmin, async (req, res) => {
  const { assignments } = req.body;
  if (!Array.isArray(assignments)) return res.status(400).json({ error: "assignments array required" });
  await storage.setUserAssociations(req.params.id, assignments);
  res.json(await storage.getUserAssociations(req.params.id));
});

export default router;
