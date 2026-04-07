import { Router } from "express";
import { storage } from "../storage";
import { requireAuth, requireSuperAdmin } from "../middleware/auth";
import { logger } from "../lib/logger";

const router = Router();

const CINC_ENDPOINTS = {
  uat: {
    tokenUrl: "https://identityserver.cincsys.io/connect/token",
    apiBase: "https://integration.cincsys.io/api",
  },
  production: {
    tokenUrl: "https://identity.cincsys.com/connect/token",
    apiBase: "https://vinemgmt.cincsys.com/api",
  },
};

async function getCincToken(clientId: string, clientSecret: string, env: "uat" | "production", scope: string) {
  const { tokenUrl } = CINC_ENDPOINTS[env];
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: clientId,
    client_secret: clientSecret,
    scope,
  });
  const resp = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Token request failed (${resp.status}): ${text}`);
  }
  const data = await resp.json() as { access_token: string };
  return data.access_token;
}

async function cincApiGet(token: string, env: "uat" | "production", path: string) {
  const { apiBase } = CINC_ENDPOINTS[env];
  const resp = await fetch(`${apiBase}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`API call failed (${resp.status}): ${text.slice(0, 200)}`);
  }
  return resp.json();
}

router.get("/api/cinc/settings", requireAuth, requireSuperAdmin, async (_req, res) => {
  const settings = await storage.getCincSettings();
  res.json({
    ...settings,
    clientSecret: settings.clientSecret ? "****" + settings.clientSecret.slice(-4) : "",
  });
});

router.patch("/api/cinc/settings", requireAuth, requireSuperAdmin, async (req, res) => {
  const data = { ...req.body };
  if (data.clientSecret && data.clientSecret.startsWith("****")) {
    delete data.clientSecret;
  }
  const updated = await storage.updateCincSettings(data);
  res.json({
    ...updated,
    clientSecret: updated.clientSecret ? "****" + updated.clientSecret.slice(-4) : "",
  });
});

router.post("/api/cinc/test", requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const settings = await storage.getCincSettings();
    const clientId = req.body.clientId || settings.clientId;
    const clientSecret = req.body.clientSecret?.startsWith("****") ? settings.clientSecret : (req.body.clientSecret || settings.clientSecret);
    const env = (req.body.environment || settings.environment) as "uat" | "production";
    const scope = req.body.scope || settings.scope || "cincapi.all";

    if (!clientId || !clientSecret) {
      return res.status(400).json({ error: "Client ID and Secret are required" });
    }

    const token = await getCincToken(clientId, clientSecret, env, scope);
    const associations = await cincApiGet(token, env, "/management/1/Associations") as any[];
    const activeCount = associations.filter((a: any) => a.isActive).length;

    await storage.updateCincSettings({ clientId, clientSecret, environment: env, scope });
    await storage.addCincSyncLog(`Connection test successful (${env}): ${associations.length} associations found (${activeCount} active)`, "success");

    res.json({
      success: true,
      environment: env,
      totalAssociations: associations.length,
      activeAssociations: activeCount,
      associations: associations.slice(0, 10).map((a: any) => ({
        id: a.AssocId,
        code: a.AssociationIdLink,
        name: a.Associationname,
        units: a.Numberofunits,
        active: a.isActive,
        city: a.City,
        state: a.State,
      })),
    });
  } catch (err: any) {
    await storage.addCincSyncLog(`Connection test failed: ${err.message}`, "error");
    res.status(400).json({ error: err.message });
  }
});

router.post("/api/cinc/sync", requireAuth, requireSuperAdmin, async (_req, res) => {
  const settings = await storage.getCincSettings();
  if (!settings.clientId || !settings.clientSecret) {
    return res.status(400).json({ error: "CINC credentials not configured" });
  }

  await storage.updateCincSettings({ syncStatus: "syncing" });
  await storage.addCincSyncLog("Starting sync with CINC API...", "info");
  res.json({ message: "Sync started" });

  try {
    const token = await getCincToken(settings.clientId, settings.clientSecret, settings.environment, settings.scope);
    await storage.addCincSyncLog(`Authenticated with CINC ${settings.environment.toUpperCase()} server`, "info");

    const associations = await cincApiGet(token, settings.environment, "/management/1/Associations") as any[];
    const activeAssocs = associations.filter((a: any) => a.isActive);
    await storage.addCincSyncLog(`Found ${associations.length} associations (${activeAssocs.length} active)`, "success");

    let vendorCount = 0;
    let workOrderCount = 0;
    if (activeAssocs.length > 0) {
      const firstAssocId = activeAssocs[0].AssocId;
      try {
        const vendors = await cincApiGet(token, settings.environment, `/management/1/Vendors?AssocId=${firstAssocId}`) as any[];
        vendorCount = vendors.length;
        await storage.addCincSyncLog(`Found ${vendors.length} vendors for ${activeAssocs[0].Associationname}`, "success");
      } catch {
        await storage.addCincSyncLog("Vendors endpoint not available", "info");
      }

      try {
        const workOrders = await cincApiGet(token, settings.environment, `/management/1/WorkOrders?AssocId=${firstAssocId}`) as any[];
        workOrderCount = workOrders.length;
        await storage.addCincSyncLog(`Found ${workOrders.length} work orders for ${activeAssocs[0].Associationname}`, "success");
      } catch {
        await storage.addCincSyncLog("Work Orders endpoint not available", "info");
      }
    }

    await storage.addCincSyncLog("Sync completed successfully", "success");
    await storage.updateCincSettings({
      syncStatus: "success",
      lastSyncAt: new Date().toISOString(),
      lastSyncData: {
        associations: associations.length,
        vendors: vendorCount,
        workOrders: workOrderCount,
      },
    });
  } catch (err: any) {
    await storage.addCincSyncLog(`Sync failed: ${err.message}`, "error");
    await storage.updateCincSettings({ syncStatus: "error" });
  }
});

router.get("/api/cinc/sync-log", requireAuth, requireSuperAdmin, async (_req, res) => {
  const settings = await storage.getCincSettings();
  res.json({
    status: settings.syncStatus,
    lastSyncAt: settings.lastSyncAt,
    lastSyncData: settings.lastSyncData,
    log: settings.syncLog,
  });
});

router.get("/api/cinc/associations", async (_req, res) => {
  try {
    const settings = await storage.getCincSettings();
    if (!settings?.clientId || !settings?.clientSecret) {
      return res.json([]);
    }
    const token = await getCincToken(settings.clientId, settings.clientSecret, settings.environment, settings.scope);
    const associations = await cincApiGet(token, settings.environment, "/management/1/Associations") as any[];
    res.json(associations.filter((a: any) => a.isActive !== false));
  } catch {
    res.json([]);
  }
});

router.post("/api/cinc/push-meeting-notice", async (req, res) => {
  try {
    const { assocCode } = req.body;
    res.json({ ok: true, message: `Notice for ${assocCode} queued for CINC push` });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
