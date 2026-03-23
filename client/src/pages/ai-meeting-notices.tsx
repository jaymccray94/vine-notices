import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Plus, Calendar, FileText, Send, Eye, Copy, Download, Sparkles,
  CheckCircle2, Clock, Users, Trash2, Printer, Code, ExternalLink, Rss,
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

/* ── FL Statute Templates ────────────────────────────────────── */

function fmtDate(d: string) {
  if (!d) return "";
  return new Date(d + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
  });
}

const boardTemplate = (d: any) => `NOTICE OF BOARD OF DIRECTORS MEETING
${d.associationName}

Date: ${fmtDate(d.meetingDate)}
Time: ${d.meetingTime}
Location: ${d.location}${d.virtualUrl ? `\nVirtual Access: ${d.virtualUrl}` : ""}

NOTICE IS HEREBY GIVEN that the Board of Directors of ${d.associationName} will hold a ${d.meetingType} meeting on ${fmtDate(d.meetingDate)} at ${d.meetingTime} at the above-referenced location.
${d.meetingType === "emergency" ? `\nTHIS IS AN EMERGENCY MEETING called pursuant to Florida Statute §720.303(2)(c) / §718.112(2)(c).\nReason for Emergency: ${d.emergencyReason || "[Specify]"}\n` : ""}
AGENDA
1. Call to Order / Establish Quorum
2. Proof of Notice / Waiver of Notice
3. Approval of Prior Meeting Minutes
${(d.agendaItems || []).map((t: string, i: number) => `${i + 4}. ${t}`).join("\n")}
${(d.agendaItems || []).length + 4}. Old Business
${(d.agendaItems || []).length + 5}. New Business
${(d.agendaItems || []).length + 6}. Homeowner Comments (3-minute limit per owner)
${(d.agendaItems || []).length + 7}. Adjournment

Pursuant to Florida Statute §720.303(2) / §718.112(2), all Board meetings are open to unit owners.
${d.meetingType !== "emergency" ? "This notice is being provided at least forty-eight (48) hours prior to the meeting as required by Florida law." : "Due to the emergency nature of this meeting, notice is being provided as soon as practicable."}

Posted: ${new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
${d.associationName} — Managed by Vine Management Group`;

const annualTemplate = (d: any) => `NOTICE OF ANNUAL MEETING OF MEMBERS
${d.associationName}

Date: ${fmtDate(d.meetingDate)}
Time: ${d.meetingTime}
Location: ${d.location}${d.virtualUrl ? `\nVirtual Access: ${d.virtualUrl}` : ""}

NOTICE IS HEREBY GIVEN that the Annual Meeting of the Members of ${d.associationName} will be held on ${fmtDate(d.meetingDate)} at ${d.meetingTime} at the above-referenced location.

PURPOSE OF MEETING
1. Establishment of Quorum
2. Proof of Notice
3. Election of Directors — ${d.seatsToFill || "___"} seats, ${d.termLength || "2-year"} terms
4. Annual Financial Report (FYE: ${d.fiscalYearEnd ? fmtDate(d.fiscalYearEnd) : "___"})
5. Proposed Budget for ${new Date().getFullYear() + 1}
${(d.agendaItems || []).map((t: string, i: number) => `${i + 6}. ${t}`).join("\n")}
${(d.agendaItems || []).length + 6}. Old Business
${(d.agendaItems || []).length + 7}. New Business
${(d.agendaItems || []).length + 8}. Homeowner Forum
${(d.agendaItems || []).length + 9}. Adjournment

PROXY INFORMATION
${d.proxyDeadline ? `Proxy Deadline: ${fmtDate(d.proxyDeadline)}` : "Proxies must be received prior to the meeting."}
Quorum requirement: ${d.quorumPercent || 30}% of total voting interests.

This notice is provided at least fourteen (14) days prior to the Annual Meeting per Florida Statute §720.306 / §718.112.

By Order of the Board of Directors
${d.associationName} — Managed by Vine Management Group`;

/* ── Types ────────────────────────────────────────────────────── */

interface NoticeRecord {
  id: string;
  type: "board" | "annual";
  meetingType: string;
  associationName: string;
  associationCode: string;
  meetingDate: string;
  meetingTime: string;
  location: string;
  virtualUrl: string;
  status: "draft" | "review" | "approved" | "sent" | "published";
  createdAt: string;
  content: string;
  pushedToCinc: boolean;
  publishedToEmbed: boolean;
}

/* ── Main Component ──────────────────────────────────────────── */

export default function AIMeetingNotices() {
  const [notices, setNotices] = useState<NoticeRecord[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [preview, setPreview] = useState<NoticeRecord | null>(null);
  const [showEmbed, setShowEmbed] = useState(false);
  const [embedAssoc, setEmbedAssoc] = useState("");
  const [activeTab, setActiveTab] = useState("board");
  const { toast } = useToast();

  // Form
  const [noticeType, setNoticeType] = useState<"board" | "annual">("board");
  const [meetingType, setMeetingType] = useState("regular");
  const [meetingDate, setMeetingDate] = useState("");
  const [meetingTime, setMeetingTime] = useState("");
  const [location, setLocation] = useState("");
  const [virtualUrl, setVirtualUrl] = useState("");
  const [agenda, setAgenda] = useState("");
  const [emergencyReason, setEmergencyReason] = useState("");
  const [selectedAssoc, setSelectedAssoc] = useState("");
  const [seatsToFill, setSeatsToFill] = useState("");
  const [termLength, setTermLength] = useState("2 years");
  const [fiscalYearEnd, setFiscalYearEnd] = useState("");
  const [proxyDeadline, setProxyDeadline] = useState("");
  const [quorumPercent, setQuorumPercent] = useState("30");
  const [generated, setGenerated] = useState("");
  const [generating, setGenerating] = useState(false);

  const { data: associations, isLoading } = useQuery<any[]>({ queryKey: ["/api/cinc/associations"] });
  const assocList = Array.isArray(associations) ? associations : [];
  const getName = (c: string) => assocList.find((a: any) => (a.AssociationCode || a.AssocCode) === c)?.AssociationName || assocList.find((a: any) => (a.AssociationCode || a.AssocCode) === c)?.Name || c;

  const generate = () => {
    setGenerating(true);
    const items = agenda.split("\n").filter(Boolean);
    const assocName = getName(selectedAssoc);
    setTimeout(() => {
      const c = noticeType === "board"
        ? boardTemplate({ associationName: assocName, meetingDate, meetingTime, location, virtualUrl, meetingType, emergencyReason, agendaItems: items })
        : annualTemplate({ associationName: assocName, meetingDate, meetingTime, location, virtualUrl, agendaItems: items, seatsToFill, termLength, fiscalYearEnd, proxyDeadline, quorumPercent });
      setGenerated(c);
      setGenerating(false);
    }, 800);
  };

  const save = () => {
    const n: NoticeRecord = {
      id: Date.now().toString(), type: noticeType, meetingType: noticeType === "board" ? meetingType : "annual",
      associationName: getName(selectedAssoc), associationCode: selectedAssoc,
      meetingDate, meetingTime, location, virtualUrl, status: "draft",
      createdAt: new Date().toISOString(), content: generated,
      pushedToCinc: false, publishedToEmbed: false,
    };
    setNotices(p => [n, ...p]);
    setShowCreate(false);
    resetForm();
    toast({ title: "Notice saved as draft" });
    // Also push to server for feed/embed
    apiRequest("POST", "/api/meeting-notices", n).catch(() => {});
  };

  const resetForm = () => {
    setMeetingDate(""); setMeetingTime(""); setLocation(""); setVirtualUrl("");
    setAgenda(""); setEmergencyReason(""); setSelectedAssoc(""); setSeatsToFill("");
    setFiscalYearEnd(""); setProxyDeadline(""); setGenerated("");
  };

  const updateStatus = (id: string, status: NoticeRecord["status"]) => {
    setNotices(p => p.map(n => n.id === id ? { ...n, status } : n));
    const notice = notices.find(n => n.id === id);
    if (notice) apiRequest("PATCH", `/api/meeting-notices/${id}`, { status }).catch(() => {});
    if (status === "published" && notice) {
      setNotices(p => p.map(n => n.id === id ? { ...n, status, publishedToEmbed: true } : n));
    }
    toast({ title: `Notice ${status}` });
  };

  const pushToCinc = async (id: string) => {
    const notice = notices.find(n => n.id === id);
    if (!notice) return;
    try {
      await apiRequest("POST", "/api/cinc/push-meeting-notice", {
        assocCode: notice.associationCode,
        type: notice.type,
        content: notice.content,
        meetingDate: notice.meetingDate,
      });
      setNotices(p => p.map(n => n.id === id ? { ...n, pushedToCinc: true } : n));
      toast({ title: "Notice pushed to CINC portal" });
    } catch {
      toast({ title: "Failed to push to CINC", variant: "destructive" });
    }
  };

  const del = (id: string) => {
    setNotices(p => p.filter(n => n.id !== id));
    apiRequest("DELETE", `/api/meeting-notices/${id}`).catch(() => {});
    toast({ title: "Notice deleted" });
  };

  const copy = (t: string) => navigator.clipboard.writeText(t).then(() => toast({ title: "Copied" }));

  const print = (content: string) => {
    const w = window.open("", "_blank");
    if (w) {
      w.document.write(`<html><head><title>Meeting Notice</title><style>body{font-family:'Times New Roman',serif;font-size:12pt;line-height:1.6;max-width:8.5in;margin:1in auto;white-space:pre-wrap;}@media print{body{margin:0;}}</style></head><body>${content.replace(/\n/g, "<br>")}</body></html>`);
      w.document.close(); w.print();
    }
  };

  const statusBg: Record<string, string> = {
    draft: "bg-yellow-100 text-yellow-800", review: "bg-blue-100 text-blue-800",
    approved: "bg-green-100 text-green-800", sent: "bg-emerald-100 text-emerald-800",
    published: "bg-purple-100 text-purple-800",
  };

  const boardNotices = notices.filter(n => n.type === "board");
  const annualNotices = notices.filter(n => n.type === "annual");

  // Build embed URL from current window
  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";

  if (isLoading) return <div className="p-6 space-y-6"><Skeleton className="h-8 w-48" /><Skeleton className="h-[400px]" /></div>;

  return (
    <div className="p-6 space-y-6" data-testid="ai-meeting-notices-page">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-display text-xl font-bold">AI Meeting Notices</h1>
          <p className="text-sm text-muted-foreground mt-1">Generate FL-compliant notices — publish to embed, push to CINC, or print</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={showEmbed} onOpenChange={setShowEmbed}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" data-testid="embed-code-button">
                <Code className="h-4 w-4 mr-1" /> Embed / Feed
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Embed Meeting Hub & Feeds</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Select Association</Label>
                  <Select value={embedAssoc} onValueChange={setEmbedAssoc}>
                    <SelectTrigger><SelectValue placeholder="Choose association" /></SelectTrigger>
                    <SelectContent>
                      {assocList.map((a: any) => (
                        <SelectItem key={a.AssociationCode || a.AssocCode} value={a.AssociationCode || a.AssocCode}>
                          {a.AssociationName || a.Name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {embedAssoc && (
                  <>
                    <div>
                      <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-1 block">iFrame Embed Code</Label>
                      <div className="bg-muted/50 rounded-md p-3 font-mono text-xs break-all">
                        {`<iframe src="${baseUrl}/api/public/meetings/${embedAssoc}/embed" width="100%" height="600" frameborder="0" style="border:none;border-radius:8px;"></iframe>`}
                      </div>
                      <Button size="sm" variant="outline" className="mt-2" onClick={() => copy(`<iframe src="${baseUrl}/api/public/meetings/${embedAssoc}/embed" width="100%" height="600" frameborder="0" style="border:none;border-radius:8px;"></iframe>`)}>
                        <Copy className="h-3.5 w-3.5 mr-1" /> Copy Embed Code
                      </Button>
                    </div>
                    <div>
                      <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-1 block">JSON Feed URL</Label>
                      <div className="bg-muted/50 rounded-md p-3 font-mono text-xs break-all">
                        {`${baseUrl}/api/public/meetings/${embedAssoc}/feed.json`}
                      </div>
                      <Button size="sm" variant="outline" className="mt-2" onClick={() => copy(`${baseUrl}/api/public/meetings/${embedAssoc}/feed.json`)}>
                        <Rss className="h-3.5 w-3.5 mr-1" /> Copy Feed URL
                      </Button>
                    </div>
                    <div>
                      <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-1 block">Direct Link</Label>
                      <div className="bg-muted/50 rounded-md p-3 font-mono text-xs break-all">
                        {`${baseUrl}/api/public/meetings/${embedAssoc}/embed`}
                      </div>
                      <Button size="sm" variant="outline" className="mt-2" onClick={() => window.open(`/api/public/meetings/${embedAssoc}/embed`, "_blank")}>
                        <ExternalLink className="h-3.5 w-3.5 mr-1" /> Open Preview
                      </Button>
                    </div>
                  </>
                )}
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={showCreate} onOpenChange={(o) => { setShowCreate(o); if (!o) resetForm(); }}>
            <DialogTrigger asChild>
              <Button data-testid="create-notice-button"><Sparkles className="h-4 w-4 mr-2" /> Generate Notice</Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary" /> AI Notice Generator</DialogTitle>
              </DialogHeader>
              <div className="grid grid-cols-2 gap-6">
                {/* Form */}
                <div className="space-y-3">
                  <div>
                    <Label>Notice Type</Label>
                    <Select value={noticeType} onValueChange={(v: "board" | "annual") => setNoticeType(v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="board">Board Meeting Notice</SelectItem>
                        <SelectItem value="annual">Annual Meeting Notice</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Association</Label>
                    <Select value={selectedAssoc} onValueChange={setSelectedAssoc}>
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>
                        {assocList.map((a: any) => (
                          <SelectItem key={a.AssociationCode || a.AssocCode} value={a.AssociationCode || a.AssocCode}>
                            {a.AssociationName || a.Name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {noticeType === "board" && (
                    <div>
                      <Label>Meeting Type</Label>
                      <Select value={meetingType} onValueChange={setMeetingType}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="regular">Regular</SelectItem>
                          <SelectItem value="special">Special</SelectItem>
                          <SelectItem value="emergency">Emergency</SelectItem>
                          <SelectItem value="organizational">Organizational</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  {meetingType === "emergency" && noticeType === "board" && (
                    <div><Label>Emergency Reason</Label><Textarea value={emergencyReason} onChange={e => setEmergencyReason(e.target.value)} className="min-h-[50px]" /></div>
                  )}
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>Date</Label><Input type="date" value={meetingDate} onChange={e => setMeetingDate(e.target.value)} /></div>
                    <div><Label>Time</Label><Input type="time" value={meetingTime} onChange={e => setMeetingTime(e.target.value)} /></div>
                  </div>
                  <div><Label>Location</Label><Input value={location} onChange={e => setLocation(e.target.value)} placeholder="Community Clubhouse, 123 Main St" /></div>
                  <div><Label>Virtual URL (optional)</Label><Input value={virtualUrl} onChange={e => setVirtualUrl(e.target.value)} placeholder="https://zoom.us/j/..." /></div>
                  {noticeType === "annual" && (
                    <>
                      <div className="grid grid-cols-2 gap-3">
                        <div><Label>Seats to Fill</Label><Input value={seatsToFill} onChange={e => setSeatsToFill(e.target.value)} placeholder="3" /></div>
                        <div><Label>Term Length</Label><Input value={termLength} onChange={e => setTermLength(e.target.value)} /></div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div><Label>Fiscal Year End</Label><Input type="date" value={fiscalYearEnd} onChange={e => setFiscalYearEnd(e.target.value)} /></div>
                        <div><Label>Proxy Deadline</Label><Input type="date" value={proxyDeadline} onChange={e => setProxyDeadline(e.target.value)} /></div>
                      </div>
                      <div><Label>Quorum %</Label><Input value={quorumPercent} onChange={e => setQuorumPercent(e.target.value)} /></div>
                    </>
                  )}
                  <div><Label>Additional Agenda Items (one per line)</Label><Textarea value={agenda} onChange={e => setAgenda(e.target.value)} className="min-h-[70px]" placeholder={"Pool renovation proposal\nLandscaping contract renewal"} /></div>
                  <Button onClick={generate} className="w-full" disabled={!selectedAssoc || !meetingDate || !meetingTime || !location || generating}>
                    {generating ? <><Sparkles className="h-4 w-4 mr-2 animate-spin" /> Generating...</> : <><Sparkles className="h-4 w-4 mr-2" /> Generate FL-Compliant Notice</>}
                  </Button>
                </div>
                {/* Preview */}
                <div className="space-y-3">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Live Preview</Label>
                  <div className="border border-border rounded-lg bg-white dark:bg-muted/30 p-4 min-h-[400px] max-h-[60vh] overflow-y-auto">
                    {generated ? (
                      <pre className="whitespace-pre-wrap text-xs leading-relaxed font-serif text-foreground">{generated}</pre>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full text-muted-foreground py-20">
                        <FileText className="h-12 w-12 mb-3 opacity-20" />
                        <p className="text-sm">Fill in details and click Generate</p>
                      </div>
                    )}
                  </div>
                  {generated && (
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => copy(generated)}><Copy className="h-3.5 w-3.5 mr-1" /> Copy</Button>
                      <Button size="sm" variant="outline" onClick={() => print(generated)}><Printer className="h-3.5 w-3.5 mr-1" /> Print</Button>
                      <Button size="sm" onClick={save} className="ml-auto"><Download className="h-3.5 w-3.5 mr-1" /> Save Draft</Button>
                    </div>
                  )}
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-5 gap-3">
        {[
          { label: "Drafts", count: notices.filter(n => n.status === "draft").length, icon: Clock, bg: "bg-yellow-50", color: "text-yellow-600" },
          { label: "In Review", count: notices.filter(n => n.status === "review").length, icon: Eye, bg: "bg-blue-50", color: "text-blue-600" },
          { label: "Approved", count: notices.filter(n => n.status === "approved").length, icon: CheckCircle2, bg: "bg-green-50", color: "text-green-600" },
          { label: "Sent", count: notices.filter(n => n.status === "sent").length, icon: Send, bg: "bg-emerald-50", color: "text-emerald-600" },
          { label: "Published", count: notices.filter(n => n.status === "published").length, icon: ExternalLink, bg: "bg-purple-50", color: "text-purple-600" },
        ].map(s => (
          <Card key={s.label} className="border border-border">
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <div className={`p-1.5 rounded-lg ${s.bg}`}><s.icon className={`h-3.5 w-3.5 ${s.color}`} /></div>
                <div><p className="text-lg font-bold">{s.count}</p><p className="text-[10px] text-muted-foreground">{s.label}</p></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="board">Board Meetings</TabsTrigger>
          <TabsTrigger value="annual">Annual Meetings</TabsTrigger>
        </TabsList>
        {["board", "annual"].map(tab => (
          <TabsContent key={tab} value={tab}>
            <Card className="border border-border">
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Association</TableHead>
                      {tab === "board" && <TableHead>Type</TableHead>}
                      <TableHead>Date</TableHead>
                      <TableHead>Time</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>CINC</TableHead>
                      <TableHead>Embed</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(tab === "board" ? boardNotices : annualNotices).map(n => (
                      <TableRow key={n.id}>
                        <TableCell className="text-sm font-medium">{n.associationName}</TableCell>
                        {tab === "board" && <TableCell><Badge variant="secondary" className="text-[10px]">{n.meetingType}</Badge></TableCell>}
                        <TableCell className="text-sm">{n.meetingDate ? new Date(n.meetingDate + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"}</TableCell>
                        <TableCell className="text-sm">{n.meetingTime}</TableCell>
                        <TableCell className="text-sm max-w-[150px] truncate">{n.location}</TableCell>
                        <TableCell><Badge className={`text-[10px] ${statusBg[n.status]}`}>{n.status}</Badge></TableCell>
                        <TableCell>{n.pushedToCinc ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <span className="text-xs text-muted-foreground">—</span>}</TableCell>
                        <TableCell>{n.publishedToEmbed ? <CheckCircle2 className="h-4 w-4 text-purple-600" /> : <span className="text-xs text-muted-foreground">—</span>}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-1 justify-end">
                            <Button size="sm" variant="ghost" onClick={() => setPreview(n)} title="Preview"><Eye className="h-3.5 w-3.5" /></Button>
                            {!n.pushedToCinc && n.status !== "draft" && (
                              <Button size="sm" variant="ghost" onClick={() => pushToCinc(n.id)} title="Push to CINC"><Send className="h-3.5 w-3.5" /></Button>
                            )}
                            <Button size="sm" variant="ghost" className="text-destructive" onClick={() => del(n.id)} title="Delete"><Trash2 className="h-3.5 w-3.5" /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {(tab === "board" ? boardNotices : annualNotices).length === 0 && (
                      <TableRow>
                        <TableCell colSpan={tab === "board" ? 9 : 8} className="text-center py-12 text-muted-foreground">
                          <Calendar className="h-10 w-10 mx-auto mb-3 opacity-20" />
                          <p className="text-sm">No {tab} meeting notices yet</p>
                          <p className="text-xs mt-1">Click "Generate Notice" to create one</p>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>

      {/* Preview */}
      <Dialog open={!!preview} onOpenChange={() => setPreview(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{preview?.type === "board" ? "Board" : "Annual"} Meeting Notice — {preview?.associationName}</DialogTitle></DialogHeader>
          <div className="border border-border rounded-lg bg-white dark:bg-muted/30 p-6">
            <pre className="whitespace-pre-wrap text-sm leading-relaxed font-serif">{preview?.content}</pre>
          </div>
          <DialogFooter className="flex gap-2 flex-wrap">
            <Button size="sm" variant="outline" onClick={() => preview && copy(preview.content)}><Copy className="h-3.5 w-3.5 mr-1" /> Copy</Button>
            <Button size="sm" variant="outline" onClick={() => preview && print(preview.content)}><Printer className="h-3.5 w-3.5 mr-1" /> Print</Button>
            {preview?.status === "draft" && <Button size="sm" onClick={() => { updateStatus(preview.id, "review"); setPreview(null); }}>Submit for Review</Button>}
            {preview?.status === "review" && <Button size="sm" onClick={() => { updateStatus(preview.id, "approved"); setPreview(null); }}>Approve</Button>}
            {preview?.status === "approved" && (
              <>
                <Button size="sm" variant="outline" onClick={() => { updateStatus(preview.id, "sent"); setPreview(null); }}>Mark Sent</Button>
                <Button size="sm" onClick={() => { updateStatus(preview.id, "published"); setPreview(null); }}>Publish to Embed</Button>
              </>
            )}
            {preview && !preview.pushedToCinc && preview.status !== "draft" && (
              <Button size="sm" variant="outline" onClick={() => { pushToCinc(preview.id); setPreview(null); }}><Send className="h-3.5 w-3.5 mr-1" /> Push to CINC</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
