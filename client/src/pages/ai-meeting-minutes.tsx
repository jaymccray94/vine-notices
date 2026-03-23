import { useQuery } from "@tanstack/react-query";
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
  Plus, FileText, Clock, CheckCircle2, AlertCircle, Copy, Printer,
  Sparkles, Trash2, Eye, ChevronDown, ChevronRight, ListChecks, Send,
  Code, ExternalLink,
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface ActionItem { id: string; description: string; assignee: string; dueDate: string; status: "pending" | "in_progress" | "completed"; }
interface MotionRecord { id: string; description: string; movedBy: string; secondedBy: string; vote: "unanimous" | "passed" | "failed" | "tabled"; }
interface MeetingRecord {
  id: string; type: "board" | "annual" | "committee" | "special";
  associationName: string; associationCode: string;
  meetingDate: string; meetingTime: string; location: string;
  attendees: string[]; absentees: string[]; quorumEstablished: boolean;
  callToOrderTime: string; adjournmentTime: string;
  status: "draft" | "pending_approval" | "approved" | "filed" | "published";
  createdAt: string; content: string;
  motions: MotionRecord[]; actionItems: ActionItem[];
}

function fmtDate(d: string) {
  if (!d) return "";
  return new Date(d + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}

const minutesTemplate = (m: MeetingRecord) => `MINUTES OF ${m.type.toUpperCase()} MEETING
${m.associationName}

Date: ${fmtDate(m.meetingDate)}
Time: ${m.meetingTime}
Location: ${m.location}

CALL TO ORDER
The meeting was called to order at ${m.callToOrderTime || m.meetingTime}.

QUORUM
${m.quorumEstablished ? "A quorum was established." : "A quorum was NOT established."}

ATTENDEES
Present: ${m.attendees.join(", ") || "[List members present]"}
${m.absentees.length > 0 ? "Absent: " + m.absentees.join(", ") : ""}
Management: Vine Management Group

APPROVAL OF PRIOR MINUTES
[Motion to approve prior meeting minutes]

MOTIONS
${m.motions.length > 0 ? m.motions.map((mo, i) => `${i+1}. ${mo.description}\n   Moved by: ${mo.movedBy} | Seconded by: ${mo.secondedBy}\n   Vote: ${mo.vote === "unanimous" ? "Passed Unanimously" : mo.vote}`).join("\n\n") : "[No motions]"}

ACTION ITEMS
${m.actionItems.length > 0 ? m.actionItems.map((a, i) => `${i+1}. ${a.description} — ${a.assignee}${a.dueDate ? ` — Due: ${a.dueDate}` : ""}`).join("\n") : "[No action items]"}

ADJOURNMENT
Adjourned at ${m.adjournmentTime || "[Time]"}.

Prepared by: Vine Management Group
Date: ${new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}

_________________________________
Secretary / Presiding Officer`;

export default function AIMeetingMinutes() {
  const [meetings, setMeetings] = useState<MeetingRecord[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [preview, setPreview] = useState<MeetingRecord | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("all");
  const { toast } = useToast();

  // Form
  const [meetingType, setMeetingType] = useState<MeetingRecord["type"]>("board");
  const [selectedAssoc, setSelectedAssoc] = useState("");
  const [meetingDate, setMeetingDate] = useState("");
  const [meetingTime, setMeetingTime] = useState("");
  const [locationText, setLocationText] = useState("");
  const [callToOrderTime, setCallToOrderTime] = useState("");
  const [adjournmentTime, setAdjournmentTime] = useState("");
  const [quorum, setQuorum] = useState(true);
  const [attendeesText, setAttendeesText] = useState("");
  const [absenteesText, setAbsenteesText] = useState("");
  const [discussionNotes, setDiscussionNotes] = useState("");
  const [generating, setGenerating] = useState(false);

  // Motions
  const [motions, setMotions] = useState<MotionRecord[]>([]);
  const [showMotion, setShowMotion] = useState(false);
  const [mDesc, setMDesc] = useState(""); const [mBy, setMBy] = useState(""); const [mSec, setMSec] = useState(""); const [mVote, setMVote] = useState<MotionRecord["vote"]>("unanimous");

  // Action Items
  const [actions, setActions] = useState<ActionItem[]>([]);
  const [showAction, setShowAction] = useState(false);
  const [aDesc, setADesc] = useState(""); const [aAssignee, setAAssignee] = useState(""); const [aDue, setADue] = useState("");

  const { data: associations, isLoading } = useQuery<any[]>({ queryKey: ["/api/cinc/associations"] });
  const assocList = Array.isArray(associations) ? associations : [];
  const getName = (c: string) => assocList.find((a: any) => (a.AssociationCode || a.AssocCode) === c)?.AssociationName || assocList.find((a: any) => (a.AssociationCode || a.AssocCode) === c)?.Name || c;

  const addMotion = () => {
    if (!mDesc || !mBy || !mSec) return;
    setMotions(p => [...p, { id: Date.now().toString(), description: mDesc, movedBy: mBy, secondedBy: mSec, vote: mVote }]);
    setMDesc(""); setMBy(""); setMSec(""); setShowMotion(false);
  };
  const addAction = () => {
    if (!aDesc || !aAssignee) return;
    setActions(p => [...p, { id: Date.now().toString(), description: aDesc, assignee: aAssignee, dueDate: aDue, status: "pending" }]);
    setADesc(""); setAAssignee(""); setADue(""); setShowAction(false);
  };

  const generate = () => {
    if (!selectedAssoc || !meetingDate) return;
    setGenerating(true);
    const m: MeetingRecord = {
      id: Date.now().toString(), type: meetingType,
      associationName: getName(selectedAssoc), associationCode: selectedAssoc,
      meetingDate, meetingTime, location: locationText,
      attendees: attendeesText.split("\n").filter(Boolean), absentees: absenteesText.split("\n").filter(Boolean),
      quorumEstablished: quorum, callToOrderTime, adjournmentTime,
      status: "draft", createdAt: new Date().toISOString(), content: "",
      motions, actionItems: actions,
    };
    setTimeout(() => {
      m.content = minutesTemplate(m);
      if (discussionNotes) {
        m.content = m.content.replace("MOTIONS", `DISCUSSION\n${discussionNotes}\n\nMOTIONS`);
      }
      setMeetings(p => [m, ...p]);
      // Push to server for embed/feed
      apiRequest("POST", "/api/meeting-minutes", m).catch(() => {});
      setShowCreate(false);
      resetForm();
      setGenerating(false);
      toast({ title: "Meeting minutes generated" });
    }, 800);
  };

  const resetForm = () => {
    setMeetingDate(""); setMeetingTime(""); setLocationText(""); setCallToOrderTime(""); setAdjournmentTime("");
    setQuorum(true); setAttendeesText(""); setAbsenteesText(""); setDiscussionNotes("");
    setMotions([]); setActions([]); setSelectedAssoc("");
  };

  const updateStatus = (id: string, status: MeetingRecord["status"]) => {
    setMeetings(p => p.map(m => m.id === id ? { ...m, status } : m));
    apiRequest("PATCH", `/api/meeting-minutes/${id}`, { status }).catch(() => {});
    toast({ title: `Minutes ${status === "approved" ? "approved" : status === "filed" ? "filed" : status === "published" ? "published to embed" : status}` });
  };

  const updateActionStatus = (mid: string, aid: string, s: ActionItem["status"]) => {
    setMeetings(p => p.map(m => m.id !== mid ? m : { ...m, actionItems: m.actionItems.map(a => a.id === aid ? { ...a, status: s } : a) }));
  };

  const del = (id: string) => { setMeetings(p => p.filter(m => m.id !== id)); apiRequest("DELETE", `/api/meeting-minutes/${id}`).catch(() => {}); toast({ title: "Deleted" }); };
  const copy = (t: string) => navigator.clipboard.writeText(t).then(() => toast({ title: "Copied" }));
  const print = (c: string) => { const w = window.open("", "_blank"); if (w) { w.document.write(`<html><head><title>Minutes</title><style>body{font-family:'Times New Roman',serif;font-size:12pt;line-height:1.6;max-width:8.5in;margin:1in auto;white-space:pre-wrap;}</style></head><body>${c.replace(/\n/g, "<br>")}</body></html>`); w.document.close(); w.print(); } };

  const statusBg: Record<string, string> = { draft: "bg-yellow-100 text-yellow-800", pending_approval: "bg-blue-100 text-blue-800", approved: "bg-green-100 text-green-800", filed: "bg-emerald-100 text-emerald-800", published: "bg-purple-100 text-purple-800" };
  const statusLabel: Record<string, string> = { draft: "Draft", pending_approval: "Pending Approval", approved: "Approved", filed: "Filed", published: "Published" };
  const typeBg: Record<string, string> = { board: "bg-primary/10 text-primary", annual: "bg-blue-100 text-blue-800", committee: "bg-purple-100 text-purple-800", special: "bg-orange-100 text-orange-800" };

  const allActions = meetings.flatMap(m => m.actionItems.map(a => ({ ...a, meetingId: m.id, assoc: m.associationName, mDate: m.meetingDate })));
  const filtered = activeTab === "all" ? meetings : activeTab === "actions" ? meetings.filter(m => m.actionItems.some(a => a.status !== "completed")) : meetings.filter(m => m.type === activeTab);

  if (isLoading) return <div className="p-6 space-y-6"><Skeleton className="h-8 w-48" /><Skeleton className="h-[400px]" /></div>;

  return (
    <div className="p-6 space-y-6" data-testid="ai-meeting-minutes-page">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-display text-xl font-bold">AI Meeting Minutes</h1>
          <p className="text-sm text-muted-foreground mt-1">Record motions, action items, and generate formatted minutes — publishable to embed</p>
        </div>
        <Dialog open={showCreate} onOpenChange={o => { setShowCreate(o); if (!o) resetForm(); }}>
          <DialogTrigger asChild>
            <Button><Sparkles className="h-4 w-4 mr-2" /> New Minutes</Button>
          </DialogTrigger>
          <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary" /> AI Minutes Generator</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Type</Label>
                    <Select value={meetingType} onValueChange={(v: MeetingRecord["type"]) => setMeetingType(v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="board">Board</SelectItem><SelectItem value="annual">Annual</SelectItem><SelectItem value="committee">Committee</SelectItem><SelectItem value="special">Special</SelectItem></SelectContent>
                    </Select>
                  </div>
                  <div><Label>Association</Label>
                    <Select value={selectedAssoc} onValueChange={setSelectedAssoc}>
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>{assocList.map((a: any) => <SelectItem key={a.AssociationCode || a.AssocCode} value={a.AssociationCode || a.AssocCode}>{a.AssociationName || a.Name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Date</Label><Input type="date" value={meetingDate} onChange={e => setMeetingDate(e.target.value)} /></div>
                  <div><Label>Time</Label><Input type="time" value={meetingTime} onChange={e => setMeetingTime(e.target.value)} /></div>
                </div>
                <div><Label>Location</Label><Input value={locationText} onChange={e => setLocationText(e.target.value)} placeholder="Community Clubhouse" /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Call to Order</Label><Input type="time" value={callToOrderTime} onChange={e => setCallToOrderTime(e.target.value)} /></div>
                  <div><Label>Adjournment</Label><Input type="time" value={adjournmentTime} onChange={e => setAdjournmentTime(e.target.value)} /></div>
                </div>
                <div className="flex items-center gap-2"><Switch checked={quorum} onCheckedChange={setQuorum} /><Label>Quorum Established</Label></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Present (one per line)</Label><Textarea value={attendeesText} onChange={e => setAttendeesText(e.target.value)} className="min-h-[60px] text-xs" placeholder={"John Smith, President\nJane Doe, Treasurer"} /></div>
                  <div><Label>Absent</Label><Textarea value={absenteesText} onChange={e => setAbsenteesText(e.target.value)} className="min-h-[60px] text-xs" placeholder="Mary Johnson" /></div>
                </div>
                <div><Label>Discussion Notes</Label><Textarea value={discussionNotes} onChange={e => setDiscussionNotes(e.target.value)} className="min-h-[80px]" placeholder="Key topics discussed, decisions, homeowner comments..." /></div>

                {/* Motions */}
                <div className="border border-border rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-semibold">Motions ({motions.length})</Label>
                    <Button size="sm" variant="outline" onClick={() => setShowMotion(!showMotion)}><Plus className="h-3 w-3 mr-1" /> Add</Button>
                  </div>
                  {showMotion && (
                    <div className="space-y-2 bg-muted/30 p-2 rounded">
                      <Textarea value={mDesc} onChange={e => setMDesc(e.target.value)} placeholder="Motion description" className="min-h-[30px] text-xs" />
                      <div className="grid grid-cols-3 gap-2">
                        <Input value={mBy} onChange={e => setMBy(e.target.value)} placeholder="Moved by" className="text-xs" />
                        <Input value={mSec} onChange={e => setMSec(e.target.value)} placeholder="Seconded by" className="text-xs" />
                        <Select value={mVote} onValueChange={(v: MotionRecord["vote"]) => setMVote(v)}>
                          <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent><SelectItem value="unanimous">Unanimous</SelectItem><SelectItem value="passed">Passed</SelectItem><SelectItem value="failed">Failed</SelectItem><SelectItem value="tabled">Tabled</SelectItem></SelectContent>
                        </Select>
                      </div>
                      <Button size="sm" onClick={addMotion} className="w-full">Add</Button>
                    </div>
                  )}
                  {motions.map((m, i) => (
                    <div key={m.id} className="flex items-start gap-2 text-xs p-2 bg-muted/20 rounded">
                      <span className="font-bold text-muted-foreground">{i+1}.</span>
                      <div className="flex-1"><p>{m.description}</p><p className="text-muted-foreground">{m.movedBy} / {m.secondedBy} — <Badge variant="secondary" className="text-[9px]">{m.vote}</Badge></p></div>
                      <Button size="sm" variant="ghost" onClick={() => setMotions(p => p.filter(x => x.id !== m.id))}><Trash2 className="h-3 w-3" /></Button>
                    </div>
                  ))}
                </div>

                {/* Action Items */}
                <div className="border border-border rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-semibold">Action Items ({actions.length})</Label>
                    <Button size="sm" variant="outline" onClick={() => setShowAction(!showAction)}><Plus className="h-3 w-3 mr-1" /> Add</Button>
                  </div>
                  {showAction && (
                    <div className="space-y-2 bg-muted/30 p-2 rounded">
                      <Input value={aDesc} onChange={e => setADesc(e.target.value)} placeholder="Action item" className="text-xs" />
                      <div className="grid grid-cols-2 gap-2">
                        <Input value={aAssignee} onChange={e => setAAssignee(e.target.value)} placeholder="Assigned to" className="text-xs" />
                        <Input type="date" value={aDue} onChange={e => setADue(e.target.value)} className="text-xs" />
                      </div>
                      <Button size="sm" onClick={addAction} className="w-full">Add</Button>
                    </div>
                  )}
                  {actions.map(a => (
                    <div key={a.id} className="flex items-center gap-2 text-xs p-2 bg-muted/20 rounded">
                      <ListChecks className="h-3.5 w-3.5 text-primary shrink-0" />
                      <div className="flex-1"><p>{a.description}</p><p className="text-muted-foreground">{a.assignee}{a.dueDate ? ` — ${a.dueDate}` : ""}</p></div>
                      <Button size="sm" variant="ghost" onClick={() => setActions(p => p.filter(x => x.id !== a.id))}><Trash2 className="h-3 w-3" /></Button>
                    </div>
                  ))}
                </div>

                <Button onClick={generate} className="w-full" disabled={!selectedAssoc || !meetingDate || generating}>
                  {generating ? <><Sparkles className="h-4 w-4 mr-2 animate-spin" /> Generating...</> : <><Sparkles className="h-4 w-4 mr-2" /> Generate Minutes</>}
                </Button>
              </div>

              {/* Guide panel */}
              <div className="space-y-4">
                <Card className="border border-border bg-primary/5"><CardContent className="p-4">
                  <h3 className="text-sm font-semibold flex items-center gap-2 mb-3"><Sparkles className="h-4 w-4 text-primary" /> AI Minutes Guide</h3>
                  <div className="space-y-3 text-xs text-muted-foreground">
                    <div><p className="font-medium text-foreground mb-1">What to Include</p>
                      <ul className="list-disc list-inside space-y-0.5">
                        <li>All motions: who moved, seconded, and vote result</li>
                        <li>Key discussion points and decisions</li>
                        <li>Action items with assignee and due date</li>
                        <li>Financial reports presented</li>
                        <li>Homeowner comments during open forum</li>
                      </ul>
                    </div>
                    <div><p className="font-medium text-foreground mb-1">FL Requirements</p>
                      <ul className="list-disc list-inside space-y-0.5">
                        <li>Minutes maintained 7 years (F.S. §720.303(4))</li>
                        <li>Available to members within 30 days of approval</li>
                        <li>Must record all motions and votes</li>
                        <li>Must note quorum establishment</li>
                      </ul>
                    </div>
                    <div><p className="font-medium text-foreground mb-1">Workflow</p>
                      <ul className="list-disc list-inside space-y-0.5">
                        <li>Draft → Pending Approval → Approved → Filed/Published</li>
                        <li>Published minutes appear in the public embed</li>
                      </ul>
                    </div>
                  </div>
                </CardContent></Card>
                <Card className="border border-border"><CardContent className="p-4">
                  <h3 className="text-sm font-semibold mb-2">Robert's Rules Quick Ref</h3>
                  <div className="text-xs space-y-1.5 text-muted-foreground">
                    <p><span className="font-medium text-foreground">Main Motion:</span> "I move that..." — second required, debatable</p>
                    <p><span className="font-medium text-foreground">Amendment:</span> "I move to amend..." — second, debatable</p>
                    <p><span className="font-medium text-foreground">Table:</span> "I move to table..." — second, not debatable</p>
                    <p><span className="font-medium text-foreground">Adjourn:</span> "I move to adjourn" — second, not debatable</p>
                  </div>
                </CardContent></Card>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Total", count: meetings.length, icon: FileText, bg: "bg-primary/10", color: "text-primary" },
          { label: "Drafts", count: meetings.filter(m => m.status === "draft").length, icon: Clock, bg: "bg-yellow-50", color: "text-yellow-600" },
          { label: "Approved/Filed", count: meetings.filter(m => m.status === "approved" || m.status === "filed" || m.status === "published").length, icon: CheckCircle2, bg: "bg-green-50", color: "text-green-600" },
          { label: "Open Actions", count: allActions.filter(a => a.status !== "completed").length, icon: AlertCircle, bg: "bg-red-50", color: "text-red-600" },
        ].map(s => (
          <Card key={s.label} className="border border-border"><CardContent className="p-3">
            <div className="flex items-center gap-2">
              <div className={`p-1.5 rounded-lg ${s.bg}`}><s.icon className={`h-3.5 w-3.5 ${s.color}`} /></div>
              <div><p className="text-lg font-bold">{s.count}</p><p className="text-[10px] text-muted-foreground">{s.label}</p></div>
            </div>
          </CardContent></Card>
        ))}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="board">Board</TabsTrigger>
          <TabsTrigger value="annual">Annual</TabsTrigger>
          <TabsTrigger value="actions">Action Items</TabsTrigger>
        </TabsList>

        <TabsContent value="actions">
          <Card className="border border-border"><CardContent className="p-0">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Action Item</TableHead><TableHead>Assigned To</TableHead><TableHead>Association</TableHead><TableHead>Meeting</TableHead><TableHead>Due</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Update</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {allActions.map(a => (
                  <TableRow key={a.id}>
                    <TableCell className="text-sm">{a.description}</TableCell>
                    <TableCell className="text-sm">{a.assignee}</TableCell>
                    <TableCell className="text-sm">{a.assoc}</TableCell>
                    <TableCell className="text-sm">{a.mDate}</TableCell>
                    <TableCell className="text-sm">{a.dueDate || "—"}</TableCell>
                    <TableCell><Badge className={`text-[10px] ${a.status === "completed" ? "bg-green-100 text-green-800" : a.status === "in_progress" ? "bg-blue-100 text-blue-800" : "bg-yellow-100 text-yellow-800"}`}>{a.status.replace("_"," ")}</Badge></TableCell>
                    <TableCell className="text-right">
                      <Select value={a.status} onValueChange={(v: ActionItem["status"]) => updateActionStatus(a.meetingId, a.id, v)}>
                        <SelectTrigger className="h-7 w-[110px] text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value="pending">Pending</SelectItem><SelectItem value="in_progress">In Progress</SelectItem><SelectItem value="completed">Completed</SelectItem></SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                ))}
                {allActions.length === 0 && <TableRow><TableCell colSpan={7} className="text-center py-10 text-muted-foreground"><ListChecks className="h-8 w-8 mx-auto mb-2 opacity-20" /><p className="text-sm">No action items</p></TableCell></TableRow>}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>

        {["all","board","annual"].map(tab => (
          <TabsContent key={tab} value={tab}>
            <Card className="border border-border"><CardContent className="p-0">
              <Table>
                <TableHeader><TableRow>
                  <TableHead className="w-8"></TableHead><TableHead>Association</TableHead><TableHead>Type</TableHead><TableHead>Date</TableHead><TableHead>Location</TableHead><TableHead>Motions</TableHead><TableHead>Actions</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {filtered.map(m => (
                    <>
                      <TableRow key={m.id} className="cursor-pointer" onClick={() => setExpanded(expanded === m.id ? null : m.id)}>
                        <TableCell>{expanded === m.id ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</TableCell>
                        <TableCell className="text-sm font-medium">{m.associationName}</TableCell>
                        <TableCell><Badge className={`text-[10px] ${typeBg[m.type]}`}>{m.type}</Badge></TableCell>
                        <TableCell className="text-sm">{m.meetingDate ? new Date(m.meetingDate + "T12:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"}) : "—"}</TableCell>
                        <TableCell className="text-sm max-w-[140px] truncate">{m.location}</TableCell>
                        <TableCell className="text-sm">{m.motions.length}</TableCell>
                        <TableCell className="text-sm">
                          {m.actionItems.filter(a => a.status !== "completed").length > 0
                            ? <Badge variant="destructive" className="text-[10px]">{m.actionItems.filter(a => a.status !== "completed").length} open</Badge>
                            : m.actionItems.length > 0 ? <Badge className="text-[10px] bg-green-100 text-green-800">Done</Badge> : "—"}
                        </TableCell>
                        <TableCell><Badge className={`text-[10px] ${statusBg[m.status]}`}>{statusLabel[m.status]}</Badge></TableCell>
                        <TableCell className="text-right" onClick={e => e.stopPropagation()}>
                          <div className="flex gap-1 justify-end">
                            <Button size="sm" variant="ghost" onClick={() => setPreview(m)}><Eye className="h-3.5 w-3.5" /></Button>
                            <Button size="sm" variant="ghost" className="text-destructive" onClick={() => del(m.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                      {expanded === m.id && (
                        <TableRow key={`${m.id}-detail`}>
                          <TableCell colSpan={9} className="bg-muted/20 p-4">
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <p className="text-xs font-semibold mb-2">Motions</p>
                                {m.motions.length > 0 ? m.motions.map((mo, i) => (
                                  <div key={mo.id} className="text-xs mb-1.5 p-2 bg-background rounded border"><p className="font-medium">{i+1}. {mo.description}</p><p className="text-muted-foreground">{mo.movedBy} / {mo.secondedBy} — {mo.vote}</p></div>
                                )) : <p className="text-xs text-muted-foreground">None</p>}
                              </div>
                              <div>
                                <p className="text-xs font-semibold mb-2">Action Items</p>
                                {m.actionItems.length > 0 ? m.actionItems.map(a => (
                                  <div key={a.id} className="text-xs mb-1.5 p-2 bg-background rounded border flex items-center gap-2">
                                    <div className="flex-1"><p className={a.status === "completed" ? "line-through text-muted-foreground" : ""}>{a.description}</p><p className="text-muted-foreground">{a.assignee}{a.dueDate ? ` — ${a.dueDate}` : ""}</p></div>
                                    <Select value={a.status} onValueChange={(v: ActionItem["status"]) => updateActionStatus(m.id, a.id, v)}>
                                      <SelectTrigger className="h-6 w-[90px] text-[10px]"><SelectValue /></SelectTrigger>
                                      <SelectContent><SelectItem value="pending">Pending</SelectItem><SelectItem value="in_progress">In Progress</SelectItem><SelectItem value="completed">Done</SelectItem></SelectContent>
                                    </Select>
                                  </div>
                                )) : <p className="text-xs text-muted-foreground">None</p>}
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  ))}
                  {filtered.length === 0 && <TableRow><TableCell colSpan={9} className="text-center py-10 text-muted-foreground"><FileText className="h-8 w-8 mx-auto mb-2 opacity-20" /><p className="text-sm">No meeting minutes yet</p></TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent></Card>
          </TabsContent>
        ))}
      </Tabs>

      {/* Preview */}
      <Dialog open={!!preview} onOpenChange={() => setPreview(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{preview?.type} Meeting Minutes — {preview?.associationName}</DialogTitle></DialogHeader>
          <div className="border border-border rounded-lg bg-white dark:bg-muted/30 p-6">
            <pre className="whitespace-pre-wrap text-sm leading-relaxed font-serif">{preview?.content}</pre>
          </div>
          <DialogFooter className="flex gap-2 flex-wrap">
            <Button size="sm" variant="outline" onClick={() => preview && copy(preview.content)}><Copy className="h-3.5 w-3.5 mr-1" /> Copy</Button>
            <Button size="sm" variant="outline" onClick={() => preview && print(preview.content)}><Printer className="h-3.5 w-3.5 mr-1" /> Print</Button>
            {preview?.status === "draft" && <Button size="sm" onClick={() => { updateStatus(preview.id, "pending_approval"); setPreview(null); }}>Submit for Approval</Button>}
            {preview?.status === "pending_approval" && <Button size="sm" onClick={() => { updateStatus(preview.id, "approved"); setPreview(null); }}>Approve</Button>}
            {preview?.status === "approved" && (
              <>
                <Button size="sm" variant="outline" onClick={() => { updateStatus(preview.id, "filed"); setPreview(null); }}>File</Button>
                <Button size="sm" onClick={() => { updateStatus(preview.id, "published"); setPreview(null); }}><ExternalLink className="h-3.5 w-3.5 mr-1" /> Publish to Embed</Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
