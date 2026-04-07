import { Router } from "express";
import { storage } from "../storage";
import { requireAuth, requireSuperAdmin } from "../middleware/auth";

const router = Router();

// Public endpoint - returns branding for the current org
router.get("/api/branding", async (_req, res) => {
  try {
    const branding = await storage.getBranding();
    res.json(branding);
  } catch {
    res.json({
      companyName: "Vine Management",
      primaryColor: "#317C3C",
      sidebarColor: "#1B3E1E",
      accentColor: "#8BC53F",
    });
  }
});

router.patch("/api/branding", requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const updated = await storage.updateBranding({
      companyName: req.body.companyName,
      primaryColor: req.body.primaryColor,
      sidebarColor: req.body.sidebarColor,
      accentColor: req.body.accentColor,
      footerText: req.body.footerText,
      logoUrl: req.body.logoUrl,
      faviconUrl: req.body.faviconUrl,
    });
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
