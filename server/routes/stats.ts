import { Router } from "express";
import { storage } from "../storage";
import { requireAuth } from "../middleware/auth";

const router = Router();

router.get("/api/stats/:associationId", requireAuth, async (req, res) => {
  const user = req.user!;
  const { associationId } = req.params;
  if (!await storage.canUserAccessAssociation(user.userId, associationId)) {
    return res.status(403).json({ error: "Access denied" });
  }

  const noticesList = await storage.listNotices(associationId);
  const meetingsList = await storage.listMeetings(associationId);
  const documents = await storage.listDocuments(associationId);
  const docsCurrent = documents.filter((d) => d.status === "current").length;

  res.json({
    notices: noticesList.length,
    meetings: meetingsList.length,
    documents: { current: docsCurrent, total: documents.length },
  });
});

export default router;
