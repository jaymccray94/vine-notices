import { Router } from "express";
import { storage, FLORIDA_DOCUMENT_CATEGORIES } from "../storage";

const router = Router();

/**
 * Escape HTML entities to prevent XSS in server-rendered HTML.
 */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ── Public Notices ──
router.get("/api/public/:slug/notices", async (req, res) => {
  const assoc = await storage.getAssociationBySlug(req.params.slug);
  if (!assoc) return res.status(404).json({ error: "Association not found" });
  const rawNotices = await storage.listNotices(assoc.id);
  const notices = rawNotices.map((n) => ({
    id: n.id,
    date: n.date,
    title: n.title,
    type: n.type,
    description: n.description,
    pdfUrl: n.pdfFilename ? `/api/uploads/${n.pdfFilename}` : undefined,
    meetingUrl: n.meetingUrl || undefined,
    postedDate: n.postedDate,
  }));
  res.json({
    association: { name: assoc.name, slug: assoc.slug, primaryColor: assoc.primaryColor, accentColor: assoc.accentColor, darkColor: assoc.darkColor },
    notices,
  });
});

// ── Public Meetings ──
router.get("/api/public/:slug/meetings", async (req, res) => {
  const assoc = await storage.getAssociationBySlug(req.params.slug);
  if (!assoc) return res.status(404).json({ error: "Association not found" });
  const rawMeetings = await storage.listMeetings(assoc.id);
  const meetings = rawMeetings.map((m) => ({
    id: m.id,
    date: m.date,
    title: m.title,
    description: m.description,
    videoUrl: m.videoUrl || undefined,
    agendaUrl: m.agendaUrl || undefined,
    minutesUrl: m.minutesUrl || undefined,
    createdAt: m.createdAt,
  }));
  res.json({
    association: { name: assoc.name, slug: assoc.slug, primaryColor: assoc.primaryColor, accentColor: assoc.accentColor, darkColor: assoc.darkColor },
    meetings,
  });
});

// ── Public Documents ──
router.get("/api/public/:slug/documents", async (req, res) => {
  const assoc = await storage.getAssociationBySlug(req.params.slug);
  if (!assoc) return res.status(404).json({ error: "Association not found" });
  const rawDocs = await storage.listDocuments(assoc.id);
  const docs = rawDocs
    .filter((d) => d.isPublic && d.status === "current")
    .map((d) => ({
      id: d.id,
      title: d.title,
      category: d.category,
      description: d.description,
      effectiveDate: d.effectiveDate,
      fileUrl: d.filename ? `/api/uploads/${d.filename}` : undefined,
      tags: d.tags,
      updatedAt: d.updatedAt,
    }));
  const categories = FLORIDA_DOCUMENT_CATEGORIES.map((c) => ({
    id: c.id,
    label: c.label,
    count: docs.filter((d) => d.category === c.id).length,
  })).filter((c) => c.count > 0);
  res.json({
    association: { name: assoc.name, slug: assoc.slug, primaryColor: assoc.primaryColor, accentColor: assoc.accentColor, darkColor: assoc.darkColor },
    categories,
    documents: docs,
  });
});

// ── Public JSON Feed (meetings from AI store) ──
router.get("/api/public/meetings/:assocCode/feed.json", async (req, res) => {
  const code = req.params.assocCode;
  // AI meeting data comes from in-memory store passed via app.locals
  const meetingNoticesStore: any[] = req.app.locals.meetingNoticesStore || [];
  const meetingMinutesStore: any[] = req.app.locals.meetingMinutesStore || [];

  const notices = meetingNoticesStore.filter((n: any) => n.associationCode === code && ["approved", "sent", "published"].includes(n.status));
  const minutes = meetingMinutesStore.filter((m: any) => m.associationCode === code && ["approved", "filed", "published"].includes(m.status));
  res.json({
    association: code,
    generatedAt: new Date().toISOString(),
    upcomingMeetings: notices.map((n: any) => ({
      id: n.id, type: n.type, meetingType: n.meetingType,
      date: n.meetingDate, time: n.meetingTime,
      location: n.location, virtualUrl: n.virtualUrl,
      status: n.status, content: n.content,
    })),
    approvedMinutes: minutes.map((m: any) => ({
      id: m.id, type: m.type, date: m.meetingDate,
      time: m.meetingTime, location: m.location,
      status: m.status, motionCount: m.motions?.length || 0,
      actionItemCount: m.actionItems?.length || 0,
      content: m.content,
    })),
  });
});

// ── Public Embeddable HTML (with XSS protection) ──
router.get("/api/public/meetings/:assocCode/embed", async (req, res) => {
  const code = req.params.assocCode;
  const meetingNoticesStore: any[] = req.app.locals.meetingNoticesStore || [];
  const meetingMinutesStore: any[] = req.app.locals.meetingMinutesStore || [];

  const notices = meetingNoticesStore.filter((n: any) => n.associationCode === code && ["approved", "sent", "published"].includes(n.status));
  const minutes = meetingMinutesStore.filter((m: any) => m.associationCode === code && ["approved", "filed", "published"].includes(m.status));
  const assocName = escapeHtml(notices[0]?.associationName || minutes[0]?.associationName || code);

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Meetings — ${assocName}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Source Sans 3',system-ui,sans-serif;background:#FAFAF5;color:#494E4B;line-height:1.6;padding:24px;max-width:800px;margin:0 auto}
h1{font-family:'DM Serif Display',Georgia,serif;color:#1B3E1E;font-size:1.4rem;margin-bottom:4px}
.sub{color:#7A7E7B;font-size:.85rem;margin-bottom:24px}
.section{margin-bottom:32px}
.section-title{font-family:'DM Serif Display',Georgia,serif;color:#317C3C;font-size:1.1rem;border-bottom:2px solid #317C3C;padding-bottom:6px;margin-bottom:16px}
.card{background:#fff;border:1px solid #E0E0D8;border-radius:8px;padding:16px;margin-bottom:12px}
.card-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px}
.badge{display:inline-block;padding:2px 8px;border-radius:4px;font-size:.7rem;font-weight:600;text-transform:uppercase}
.badge-board{background:#E8F5E9;color:#1B3E1E}.badge-annual{background:#E3F2FD;color:#1565C0}
.meta{font-size:.8rem;color:#7A7E7B}
pre{white-space:pre-wrap;font-family:'Times New Roman',serif;font-size:.85rem;line-height:1.5;background:#FAFAF5;border:1px solid #E0E0D8;border-radius:6px;padding:12px;margin-top:8px;max-height:300px;overflow-y:auto}
.empty{text-align:center;padding:40px;color:#A0A4A1;font-size:.9rem}
.toggle{cursor:pointer;color:#317C3C;font-size:.8rem;text-decoration:underline}
.vine{text-align:center;margin-top:24px;font-size:.75rem;color:#A0A4A1}
.vine a{color:#317C3C;text-decoration:none}
</style>
<link href="https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=Source+Sans+3:wght@400;600&display=swap" rel="stylesheet">
</head>
<body>
<h1>${assocName}</h1>
<p class="sub">Meeting Notices &amp; Minutes</p>

<div class="section">
<h2 class="section-title">Upcoming Meetings</h2>
${notices.length > 0 ? notices.map((n: any) => `<div class="card">
<div class="card-header"><span class="badge badge-${escapeHtml(n.type)}">${escapeHtml(n.type)} Meeting</span><span class="meta">${escapeHtml(n.meetingDate || '')}</span></div>
<p><strong>${escapeHtml(n.meetingTime || '')}</strong> — ${escapeHtml(n.location || '')}</p>
${n.virtualUrl ? '<p class="meta">Virtual: ' + escapeHtml(n.virtualUrl) + '</p>' : ''}
<details><summary class="toggle">View Full Notice</summary><pre>${escapeHtml(n.content || '')}</pre></details>
</div>`).join('\n') : '<p class="empty">No upcoming meetings posted</p>'}
</div>

<div class="section">
<h2 class="section-title">Approved Minutes</h2>
${minutes.length > 0 ? minutes.map((m: any) => `<div class="card">
<div class="card-header"><span class="badge badge-${escapeHtml(m.type)}">${escapeHtml(m.type)} Meeting</span><span class="meta">${escapeHtml(m.meetingDate || '')}</span></div>
<p class="meta">${m.motions?.length || 0} motions · ${m.actionItems?.length || 0} action items</p>
<details><summary class="toggle">View Full Minutes</summary><pre>${escapeHtml(m.content || '')}</pre></details>
</div>`).join('\n') : '<p class="empty">No approved minutes posted</p>'}
</div>

<p class="vine">Managed by <a href="https://vinemgt.com" target="_blank">Vine Management Group</a></p>
</body></html>`;
  res.setHeader("Content-Type", "text/html");
  res.setHeader("X-Frame-Options", "ALLOWALL");
  res.send(html);
});

export default router;
