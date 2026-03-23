import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest, apiUpload } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import type { Notice, Association } from "@shared/schema";
import { NOTICE_TYPES } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, FileText, Upload, X, Video, Calendar, Loader2, Search } from "lucide-react";

export default function AdminNoticesPage({ associationId }: { associationId: string }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [editing, setEditing] = useState<Notice | null>(null);
  const [creating, setCreating] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [yearFilter, setYearFilter] = useState("all");
  const canManage = user?.role === "super_admin" || user?.associations?.some(
    (a) => a.associationId === associationId && a.permission === "manage"
  );

  const { data: notices = [], isLoading } = useQuery<Notice[]>({
    queryKey: ["/api/associations", associationId, "notices"],
    enabled: !!associationId,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/notices/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/associations", associationId, "notices"] });
      toast({ title: "Notice deleted" });
    },
  });

  // Compute available years from notice dates
  const availableYears = useMemo(() => {
    const years = new Set<string>();
    notices.forEach((n) => {
      const y = n.date?.slice(0, 4);
      if (y) years.add(y);
    });
    return [...years].sort((a, b) => b.localeCompare(a)); // newest first
  }, [notices]);

  // Compute available types from notices
  const availableTypes = useMemo(() => {
    const types = new Set<string>();
    notices.forEach((n) => {
      if (n.type) types.add(n.type);
    });
    return [...types].sort();
  }, [notices]);

  // Apply filters
  const filtered = useMemo(() => {
    let result = [...notices];
    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter((n) =>
        n.title.toLowerCase().includes(q) ||
        (n.description || "").toLowerCase().includes(q) ||
        (n.type || "").toLowerCase().includes(q)
      );
    }
    // Type filter
    if (typeFilter !== "all") {
      result = result.filter((n) => n.type === typeFilter);
    }
    // Year filter
    if (yearFilter !== "all") {
      result = result.filter((n) => n.date?.startsWith(yearFilter));
    }
    // Sort by date desc
    result.sort((a, b) => b.date.localeCompare(a.date));
    return result;
  }, [notices, searchQuery, typeFilter, yearFilter]);

  const hasFilters = searchQuery.trim() !== "" || typeFilter !== "all" || yearFilter !== "all";

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3 p-6">
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 rounded-lg" />)}
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-bold" data-testid="text-notices-heading">Notices</h2>
          <p className="text-sm text-muted-foreground">{notices.length} notice{notices.length !== 1 ? "s" : ""} posted</p>
        </div>
        {canManage && (
          <Button onClick={() => setCreating(true)} size="sm" data-testid="button-create-notice">
            <Plus className="w-4 h-4 mr-1.5" />
            New Notice
          </Button>
        )}
      </div>

      {/* Search & Filters */}
      {notices.length > 0 && (
        <div className="flex flex-col gap-3 mb-5" data-testid="filter-bar">
          {/* Search input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search notices..."
              className="pl-9 h-9"
              data-testid="input-search"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Type and Year filters */}
          <div className="flex gap-2 flex-wrap items-center">
            {/* Year tabs */}
            <div className="flex items-center gap-1 bg-muted rounded-lg p-0.5" data-testid="year-tabs">
              <button
                onClick={() => setYearFilter("all")}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                  yearFilter === "all"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                data-testid="year-tab-all"
              >
                All Years
              </button>
              {availableYears.map((y) => (
                <button
                  key={y}
                  onClick={() => setYearFilter(y)}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                    yearFilter === y
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  data-testid={`year-tab-${y}`}
                >
                  {y}
                </button>
              ))}
            </div>

            {/* Type dropdown */}
            {availableTypes.length > 1 && (
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="h-8 w-[160px] text-xs" data-testid="select-type-filter">
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {availableTypes.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* Active filter count / clear */}
            {hasFilters && (
              <button
                onClick={() => { setSearchQuery(""); setTypeFilter("all"); setYearFilter("all"); }}
                className="text-xs text-primary hover:text-primary/80 font-medium ml-1"
                data-testid="button-clear-filters"
              >
                Clear filters
              </button>
            )}

            <span className="ml-auto text-xs text-muted-foreground" data-testid="text-filter-count">
              {filtered.length === notices.length
                ? ""
                : `Showing ${filtered.length} of ${notices.length}`}
            </span>
          </div>
        </div>
      )}

      {filtered.length === 0 && notices.length > 0 ? (
        <div className="text-center py-12 text-muted-foreground" data-testid="no-results">
          <Search className="w-8 h-8 mx-auto mb-3 opacity-40" />
          <p className="text-sm font-medium">No notices match your filters</p>
          <p className="text-xs mt-1">Try adjusting your search or filters.</p>
          <Button
            variant="ghost"
            size="sm"
            className="mt-3 text-xs"
            onClick={() => { setSearchQuery(""); setTypeFilter("all"); setYearFilter("all"); }}
          >
            Clear all filters
          </Button>
        </div>
      ) : notices.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground" data-testid="empty-notices">
          <FileText className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm font-medium">No notices yet</p>
          <p className="text-xs mt-1">Create your first notice to get started.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map((notice) => (
            <Card key={notice.id} className="hover:shadow-sm transition-shadow" data-testid={`card-notice-${notice.id}`}>
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-semibold text-sm truncate">{notice.title}</span>
                      <Badge variant="secondary" className="text-[11px]">{notice.type}</Badge>
                      {notice.pdfFilename && (
                        <Badge variant="outline" className="text-[11px] gap-1">
                          <FileText className="w-3 h-3" /> PDF
                        </Badge>
                      )}
                      {notice.meetingUrl && (
                        <Badge variant="outline" className="text-[11px] gap-1">
                          <Video className="w-3 h-3" /> Meeting
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {new Date(notice.date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </span>
                      {notice.description && (
                        <span className="truncate max-w-[300px]">{notice.description}</span>
                      )}
                    </div>
                  </div>
                  {canManage && (
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setEditing(notice)} data-testid={`button-edit-${notice.id}`}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                        onClick={() => {
                          if (confirm("Delete this notice?")) deleteMutation.mutate(notice.id);
                        }}
                        data-testid={`button-delete-${notice.id}`}
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
        <NoticeDialog
          notice={editing}
          associationId={associationId}
          onClose={() => { setCreating(false); setEditing(null); }}
        />
      )}
    </div>
  );
}

function NoticeDialog({
  notice,
  associationId,
  onClose,
}: {
  notice: Notice | null;
  associationId: string;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const isEdit = !!notice;
  const [title, setTitle] = useState(notice?.title || "");
  const [type, setType] = useState(notice?.type || "General");
  const [date, setDate] = useState(notice?.date || new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState(notice?.description || "");
  const [meetingUrl, setMeetingUrl] = useState(notice?.meetingUrl || "");
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!title.trim()) {
      toast({ title: "Title is required", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      let noticeId = notice?.id;
      if (isEdit) {
        await apiRequest("PATCH", `/api/notices/${noticeId}`, { title, type, date, description, meetingUrl });
      } else {
        const res = await apiRequest("POST", `/api/associations/${associationId}/notices`, {
          associationId,
          title,
          type,
          date,
          description,
          meetingUrl,
        });
        const created = await res.json();
        noticeId = created.id;
      }
      // Upload PDF if selected
      if (pdfFile && noticeId) {
        const formData = new FormData();
        formData.append("pdf", pdfFile);
        await apiUpload(`/api/notices/${noticeId}/pdf`, formData);
      }
      queryClient.invalidateQueries({ queryKey: ["/api/associations", associationId, "notices"] });
      toast({ title: isEdit ? "Notice updated" : "Notice created" });
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
          <DialogTitle data-testid="text-dialog-title">{isEdit ? "Edit Notice" : "New Notice"}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4 mt-2">
          <div className="flex flex-col gap-1.5">
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Notice title" data-testid="input-notice-title" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>Type</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger data-testid="select-notice-type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {NOTICE_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Date</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} data-testid="input-notice-date" />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional description" rows={3} data-testid="input-notice-description" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Meeting URL</Label>
            <Input value={meetingUrl} onChange={(e) => setMeetingUrl(e.target.value)} placeholder="https://zoom.us/..." data-testid="input-meeting-url" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>PDF Document</Label>
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-2 px-3 py-2 text-sm border rounded-md cursor-pointer hover:bg-accent transition-colors">
                <Upload className="w-4 h-4" />
                {pdfFile ? pdfFile.name : notice?.pdfFilename ? "Replace PDF" : "Choose PDF"}
                <input
                  type="file"
                  accept=".pdf"
                  className="hidden"
                  onChange={(e) => setPdfFile(e.target.files?.[0] || null)}
                  data-testid="input-pdf-file"
                />
              </label>
              {pdfFile && (
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setPdfFile(null)}>
                  <X className="w-4 h-4" />
                </Button>
              )}
              {notice?.pdfFilename && !pdfFile && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <FileText className="w-3 h-3" /> PDF attached
                </span>
              )}
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-2">
            <Button variant="outline" onClick={onClose} data-testid="button-cancel">Cancel</Button>
            <Button onClick={handleSave} disabled={saving} data-testid="button-save-notice">
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : null}
              {isEdit ? "Save Changes" : "Create Notice"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
