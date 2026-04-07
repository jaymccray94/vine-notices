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

  const tickets = await storage.listTickets(associationId);
  const ticketOpen = tickets.filter((t) => t.status === "open").length;
  const ticketInProgress = tickets.filter((t) => t.status === "in_progress").length;

  const policies = await storage.listInsurancePolicies(associationId);
  const now60 = new Date();
  now60.setDate(now60.getDate() + 60);
  const expiringCutoff = now60.toISOString().slice(0, 10);
  const todayStr = new Date().toISOString().slice(0, 10);
  const expiringSoon = policies.filter(
    (p) => p.expirationDate >= todayStr && p.expirationDate <= expiringCutoff
  ).length;

  const mailings = await storage.listMailingRequests(associationId);
  const mailingPending = mailings.filter((m) => m.status === "pending_approval" || m.status === "draft").length;

  const checklists = await storage.listOnboardingChecklists(associationId);
  const allItems = checklists.flatMap((c) => c.items);
  const completedChecklists = checklists.filter((c) => c.items.length > 0 && c.items.every((i) => i.completed)).length;

  const accounting = await storage.listAccountingItems(associationId);
  const accountingOutstanding = accounting.filter((a) => a.status === "outstanding" || a.status === "partial").length;
  const accountingOverdue = accounting.filter((a) => a.status === "overdue").length;
  const totalOwed = accounting
    .filter((a) => a.status !== "paid" && a.status !== "written_off")
    .reduce((sum, a) => sum + (a.amount - a.amountPaid), 0);

  const invoices = await storage.listInvoices(associationId);
  const invoicesPending = invoices.filter((inv) => inv.status === "uploaded" || inv.status === "processing" || inv.status === "review").length;

  const documents = await storage.listDocuments(associationId);
  const docsCurrent = documents.filter((d) => d.status === "current").length;

  const vendors = await storage.listVendors(associationId);
  const vendorsActive = vendors.filter((v) => v.status === "active").length;

  res.json({
    notices: noticesList.length,
    meetings: meetingsList.length,
    tickets: { open: ticketOpen, inProgress: ticketInProgress, total: tickets.length },
    insurance: { total: policies.length, expiringSoon },
    mailings: { pending: mailingPending, total: mailings.length },
    onboarding: {
      completed: completedChecklists,
      total: checklists.length,
      items: { completed: allItems.filter((i) => i.completed).length, total: allItems.length },
    },
    accounting: { outstanding: accountingOutstanding, overdue: accountingOverdue, totalOwed },
    invoices: { pending: invoicesPending, total: invoices.length },
    documents: { current: docsCurrent, total: documents.length },
    vendors: { active: vendorsActive, total: vendors.length },
  });
});

export default router;
