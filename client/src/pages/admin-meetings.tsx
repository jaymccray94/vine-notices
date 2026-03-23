import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import type { Meeting } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Video, Calendar, Loader2, FileText, Link as LinkIcon } from "lucide-react";

export default function AdminMeetingsPage({ associationId }: { associationId: string }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [editing, setEditing] = useState<Meeting | null>(null);
  const [creating, setCreating] = useState(false);
  const canManage = user?.role === "super_admin" || user?.associations?.some(
    (a) => a.associationId === associationId && a.permission === "manage"
  );

  const { data: meetings = [], isLoading } = useQuery<Meeting[]>({
    queryKey: ["/api/associations", associationId, "meetings"],
    enabled: !!associationId,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/meetings/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/associations", associationId, "meetings"] });
      toast({ title: "Meeting record deleted" });
    },
  });

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3 p-6">
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 rounded-lg" />)}
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-bold" data-testid="text-meetings-heading">Meetings</h2>
          <p className="text-sm text-muted-foreground">{meetings.length} meeting{meetings.length !== 1 ? "s" : ""} recorded</p>
        </div>
        {canManage && (
          <Button onClick={() => setCreating(true)} size="sm" data-testid="button-create-meeting">
            <Plus className="w-4 h-4 mr-1.5" />
            New Meeting
          </Button>
        )}
      </div>

      {meetings.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground" data-testid="empty-meetings">
          <Video className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm font-medium">No meetings recorded yet</p>
          <p className="text-xs mt-1">Add your first meeting record to get started.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {meetings.map((meeting) => (
            <Card key={meeting.id} className="hover:shadow-sm transition-shadow" data-testid={`card-meeting-${meeting.id}`}>
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-semibold text-sm">{meeting.title}</span>
                      {meeting.videoUrl && (
                        <Badge variant="outline" className="text-[11px] gap-1">
                          <Video className="w-3 h-3" /> Video
                        </Badge>
                      )}
                      {meeting.agendaUrl && (
                        <Badge variant="outline" className="text-[11px] gap-1">
                          <FileText className="w-3 h-3" /> Agenda
                        </Badge>
                      )}
                      {meeting.minutesUrl && (
                        <Badge variant="outline" className="text-[11px] gap-1">
                          <FileText className="w-3 h-3" /> Minutes
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {new Date(meeting.date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </span>
                      {meeting.description && (
                        <span className="truncate max-w-[300px]">{meeting.description}</span>
                      )}
                    </div>
                    {/* Quick links row */}
                    {(meeting.videoUrl || meeting.agendaUrl || meeting.minutesUrl) && (
                      <div className="flex items-center gap-3 mt-2">
                        {meeting.videoUrl && (
                          <a href={meeting.videoUrl} target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary/80 font-medium"
                            data-testid={`link-video-${meeting.id}`}
                          >
                            <Video className="w-3 h-3" /> Watch Recording
                          </a>
                        )}
                        {meeting.agendaUrl && (
                          <a href={meeting.agendaUrl} target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary/80 font-medium"
                            data-testid={`link-agenda-${meeting.id}`}
                          >
                            <LinkIcon className="w-3 h-3" /> Agenda
                          </a>
                        )}
                        {meeting.minutesUrl && (
                          <a href={meeting.minutesUrl} target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary/80 font-medium"
                            data-testid={`link-minutes-${meeting.id}`}
                          >
                            <LinkIcon className="w-3 h-3" /> Minutes
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                  {canManage && (
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setEditing(meeting)} data-testid={`button-edit-meeting-${meeting.id}`}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                        onClick={() => {
                          if (confirm("Delete this meeting record?")) deleteMutation.mutate(meeting.id);
                        }}
                        data-testid={`button-delete-meeting-${meeting.id}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create / Edit Dialog */}
      {(creating || editing) && (
        <MeetingDialog
          meeting={editing}
          associationId={associationId}
          onClose={() => { setCreating(false); setEditing(null); }}
        />
      )}
    </div>
  );
}

function MeetingDialog({
  meeting,
  associationId,
  onClose,
}: {
  meeting: Meeting | null;
  associationId: string;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const isEdit = !!meeting;
  const [title, setTitle] = useState(meeting?.title || "");
  const [date, setDate] = useState(meeting?.date || new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState(meeting?.description || "");
  const [videoUrl, setVideoUrl] = useState(meeting?.videoUrl || "");
  const [agendaUrl, setAgendaUrl] = useState(meeting?.agendaUrl || "");
  const [minutesUrl, setMinutesUrl] = useState(meeting?.minutesUrl || "");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!title.trim()) {
      toast({ title: "Title is required", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      if (isEdit) {
        await apiRequest("PATCH", `/api/meetings/${meeting.id}`, { title, date, description, videoUrl, agendaUrl, minutesUrl });
      } else {
        await apiRequest("POST", `/api/associations/${associationId}/meetings`, {
          associationId,
          title,
          date,
          description,
          videoUrl,
          agendaUrl,
          minutesUrl,
        });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/associations", associationId, "meetings"] });
      toast({ title: isEdit ? "Meeting updated" : "Meeting created" });
      onClose();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle data-testid="text-meeting-dialog-title">{isEdit ? "Edit Meeting" : "New Meeting"}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4 mt-2">
          <div className="flex flex-col gap-1.5">
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Board of Directors Meeting" data-testid="input-meeting-title" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Date</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} data-testid="input-meeting-date" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional description of the meeting" rows={2} data-testid="input-meeting-description" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="flex items-center gap-1.5"><Video className="w-3.5 h-3.5" /> Video Recording URL</Label>
            <Input value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} placeholder="https://youtube.com/watch?v=... or https://zoom.us/rec/..." data-testid="input-video-url" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="flex items-center gap-1.5"><FileText className="w-3.5 h-3.5" /> Agenda URL</Label>
            <Input value={agendaUrl} onChange={(e) => setAgendaUrl(e.target.value)} placeholder="https://... (optional)" data-testid="input-agenda-url" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="flex items-center gap-1.5"><FileText className="w-3.5 h-3.5" /> Minutes URL</Label>
            <Input value={minutesUrl} onChange={(e) => setMinutesUrl(e.target.value)} placeholder="https://... (optional)" data-testid="input-minutes-url" />
          </div>
          <div className="flex justify-end gap-2 mt-2">
            <Button variant="outline" onClick={onClose} data-testid="button-cancel-meeting">Cancel</Button>
            <Button onClick={handleSave} disabled={saving} data-testid="button-save-meeting">
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : null}
              {isEdit ? "Save Changes" : "Create Meeting"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
