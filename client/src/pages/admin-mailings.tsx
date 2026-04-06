import { EmptyState } from "@/components/empty-state";
import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import type { MailingRequest } from "@shared/schema";
import { MAILING_STATUSES } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  Plus,
  Pencil,
  Trash2,
  Mail,
  Loader2,
  Users,
  Calendar,
} from "lucide-react";

// ── Status config ──────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; bg: string }
> = {
  draft: { label: "Draft", color: "#6B7280", bg: "#F3F4F6" },
  pending_approval: { label: "Pending Approval", color: "#F59E0B", bg: "#FEF3C7" },
  approved: { label: "Approved", color: "#22C55E", bg: "#DCFCE7" },
  in_production: { label: "In Production", color: "#3B82F6", bg: "#DBEAFE" },
  mailed: { label: "Mailed", color: "#059669", bg: "#D1FAE5" },
  cancelled: { label: "Cancelled", color: "#DC2626", bg: "#FEE2E2" },
};

const ALL_FILTER_TABS = [
  { value: "all", label: "All" },
  { value: "draft", label: "Draft" },
  { value: "pending_approval", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "in_production", label: "In Production" },
  { value: "mailed", label: "Mailed" },
  { value: "cancelled", label: "Cancelled" },
];

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? { label: status, color: "#6B7280", bg: "#F3F4F6" };
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold"
      style={{ backgroundColor: cfg.bg, color: cfg.color }}
      data-testid={`badge-status-${status}`}
    >
      {cfg.label}
    </span>
  );
}

function formatDate(dateStr: string | undefined) {
  if (!dateStr) return "—";
  // Handle both ISO timestamps and YYYY-MM-DD date strings
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// ── Main Page ──────────────────────────────────────────────────────────────

export default function AdminMailingsPage({ associationId }: { associationId: string }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [editing, setEditing] = useState<MailingRequest | null>(null);
  const [creating, setCreating] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const canManage =
    user?.role === "super_admin" ||
    user?.associations?.some(
      (a) => a.associationId === associationId && a.permission === "manage"
    );

  const { data: mailings = [], isLoading } = useQuery<MailingRequest[]>({
    queryKey: ["/api/mailings", associationId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/mailings/${associationId}`);
      return res.json();
    },
    enabled: !!associationId,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/mailings/item/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/mailings", associationId] });
      toast({ title: "Mailing request deleted" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  // ── Summary stats ──────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const total = mailings.length;
    const pending = mailings.filter((m) => m.status === "pending_approval").length;
    const mailed = mailings.filter((m) => m.status === "mailed").length;
    return { total, pending, mailed };
  }, [mailings]);

  // ── Filtered list ──────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    if (statusFilter === "all") return mailings;
    return mailings.filter((m) => m.status === statusFilter);
  }, [mailings, statusFilter]);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3 p-6">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-28 rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-bold" data-testid="text-mailings-heading">
            Mailings
          </h2>
          <p className="text-sm text-muted-foreground">
            {mailings.length} mailing request{mailings.length !== 1 ? "s" : ""}
          </p>
        </div>
        {canManage && (
          <Button
            onClick={() => setCreating(true)}
            size="sm"
            data-testid="button-create-mailing"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            New Mailing
          </Button>
        )}
      </div>

      {/* Summary stats */}
      {mailings.length > 0 && (
        <div className="grid grid-cols-3 gap-3 mb-5" data-testid="mailings-stats">
          <SummaryCard label="Total Requests" value={String(stats.total)} testId="stat-total" />
          <SummaryCard
            label="Pending Approval"
            value={String(stats.pending)}
            valueColor={stats.pending > 0 ? "#F59E0B" : undefined}
            testId="stat-pending"
          />
          <SummaryCard
            label="Mailed"
            value={String(stats.mailed)}
            valueColor="#059669"
            testId="stat-mailed"
          />
        </div>
      )}

      {/* Status filter tabs */}
      {mailings.length > 0 && (
        <div
          className="flex items-center gap-1 flex-wrap mb-4 bg-muted rounded-lg p-1 w-fit"
          data-testid="status-filter-tabs"
        >
          {ALL_FILTER_TABS.map(({ value, label }) => {
            const count = value === "all" ? mailings.length : mailings.filter((m) => m.status === value).length;
            if (value !== "all" && count === 0) return null;
            return (
              <button
                key={value}
                onClick={() => setStatusFilter(value)}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                  statusFilter === value
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                data-testid={`filter-tab-${value}`}
              >
                {label}
                {value !== "all" && (
                  <span className="ml-1 text-[10px] opacity-60">({count})</span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Empty state */}
      {mailings.length === 0 ? (
        <div
          className="text-center py-16 text-muted-foreground"
          data-testid="empty-mailings"
        >
          <EmptyState
            icon={Mail}
            title="No mailing requests yet"
            description="Request and track community mailings — assessments, violations, and official notices."
            actionLabel="New Mailing"
            onAction={() => setCreating(true)}
            showAction={canManage}
          />
        </div>
      ) : filtered.length === 0 ? (
        <div
          className="text-center py-12 text-muted-foreground"
          data-testid="no-filtered-mailings"
        >
          <Mail className="w-8 h-8 mx-auto mb-3 opacity-40" />
          <p className="text-sm font-medium">No mailings with this status</p>
          <Button
            variant="ghost"
            size="sm"
            className="mt-2 text-xs"
            onClick={() => setStatusFilter("all")}
            data-testid="button-clear-filter"
          >
            Show all
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((mailing) => (
            <MailingCard
              key={mailing.id}
              mailing={mailing}
              canManage={canManage}
              onEdit={setEditing}
              onDelete={(id) => {
                if (confirm("Delete this mailing request?")) deleteMutation.mutate(id);
              }}
            />
          ))}
        </div>
      )}

      {(creating || editing) && (
        <MailingDialog
          mailing={editing}
          associationId={associationId}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

// ── Summary card ─────────────────────────────────────────────────────────────

function SummaryCard({
  label,
  value,
  valueColor,
  testId,
}: {
  label: string;
  value: string;
  valueColor?: string;
  testId: string;
}) {
  return (
    <Card data-testid={testId}>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground mb-1">{label}</p>
        <p
          className="text-xl font-bold"
          style={valueColor ? { color: valueColor } : undefined}
        >
          {value}
        </p>
      </CardContent>
    </Card>
  );
}

// ── Mailing Card ─────────────────────────────────────────────────────────────

function MailingCard({
  mailing,
  canManage,
  onEdit,
  onDelete,
}: {
  mailing: MailingRequest;
  canManage: boolean | undefined;
  onEdit: (m: MailingRequest) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <Card
      className="hover:shadow-sm transition-shadow"
      data-testid={`card-mailing-${mailing.id}`}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          <div className="flex-1 min-w-0">
            {/* Title + badges */}
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="font-semibold text-sm">{mailing.title}</span>
              <StatusBadge status={mailing.status} />
              {mailing.mailingType && (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-muted text-muted-foreground">
                  {mailing.mailingType}
                </span>
              )}
            </div>

            {/* Meta row */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              {mailing.recipientCount != null && (
                <span
                  className="flex items-center gap-1"
                  data-testid={`text-recipients-${mailing.id}`}
                >
                  <Users className="w-3 h-3" />
                  {mailing.recipientCount.toLocaleString()} recipient
                  {mailing.recipientCount !== 1 ? "s" : ""}
                </span>
              )}
              {mailing.targetMailDate && (
                <span
                  className="flex items-center gap-1"
                  data-testid={`text-mail-date-${mailing.id}`}
                >
                  <Calendar className="w-3 h-3" />
                  Target: {formatDate(mailing.targetMailDate)}
                </span>
              )}
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3 opacity-50" />
                Requested: {formatDate(mailing.requestedDate)}
              </span>
            </div>

            {mailing.description && (
              <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">
                {mailing.description}
              </p>
            )}
          </div>

          {canManage && (
            <div className="flex items-center gap-1 flex-shrink-0">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => onEdit(mailing)}
                data-testid={`button-edit-mailing-${mailing.id}`}
              >
                <Pencil className="w-3.5 h-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                onClick={() => onDelete(mailing.id)}
                data-testid={`button-delete-mailing-${mailing.id}`}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Create / Edit Dialog ────────────────────────────────────────────────────

function MailingDialog({
  mailing,
  associationId,
  onClose,
}: {
  mailing: MailingRequest | null;
  associationId: string;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const isEdit = !!mailing;

  const [title, setTitle] = useState(mailing?.title ?? "");
  const [description, setDescription] = useState(mailing?.description ?? "");
  const [mailingType, setMailingType] = useState(mailing?.mailingType ?? "");
  const [recipientCount, setRecipientCount] = useState(
    mailing?.recipientCount != null ? String(mailing.recipientCount) : ""
  );
  const [status, setStatus] = useState<string>(mailing?.status ?? "draft");
  const [targetMailDate, setTargetMailDate] = useState(mailing?.targetMailDate ?? "");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!title.trim()) {
      toast({ title: "Title is required", variant: "destructive" });
      return;
    }
    if (!mailingType.trim()) {
      toast({ title: "Mailing type is required", variant: "destructive" });
      return;
    }

    const payload: Record<string, unknown> = {
      title,
      description: description || undefined,
      mailingType,
      status,
      targetMailDate: targetMailDate || undefined,
    };
    if (recipientCount.trim()) {
      const parsed = parseInt(recipientCount, 10);
      if (!isNaN(parsed)) payload.recipientCount = parsed;
    }

    setSaving(true);
    try {
      if (isEdit) {
        await apiRequest("PATCH", `/api/mailings/item/${mailing.id}`, payload);
      } else {
        await apiRequest("POST", `/api/mailings/${associationId}`, {
          ...payload,
          associationId,
        });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/mailings", associationId] });
      toast({ title: isEdit ? "Mailing updated" : "Mailing request created" });
      onClose();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  // Human-readable status labels for the select
  const STATUS_LABELS: Record<string, string> = {
    draft: "Draft",
    pending_approval: "Pending Approval",
    approved: "Approved",
    in_production: "In Production",
    mailed: "Mailed",
    cancelled: "Cancelled",
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle data-testid="text-mailing-dialog-title">
            {isEdit ? "Edit Mailing Request" : "New Mailing Request"}
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4 mt-2">
          <div className="flex flex-col gap-1.5">
            <Label>Title</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Annual Meeting Notice, Assessment Letter..."
              data-testid="input-mailing-title"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Description</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of the mailing (optional)"
              rows={2}
              data-testid="input-mailing-description"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>Mailing Type</Label>
              <Input
                value={mailingType}
                onChange={(e) => setMailingType(e.target.value)}
                placeholder="Letter, Postcard, Newsletter..."
                data-testid="input-mailing-type"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Recipient Count</Label>
              <Input
                type="number"
                min={0}
                value={recipientCount}
                onChange={(e) => setRecipientCount(e.target.value)}
                placeholder="0"
                data-testid="input-recipient-count"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger data-testid="select-mailing-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MAILING_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {STATUS_LABELS[s] ?? s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Target Mail Date</Label>
              <Input
                type="date"
                value={targetMailDate}
                onChange={(e) => setTargetMailDate(e.target.value)}
                data-testid="input-target-mail-date"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-2">
            <Button variant="outline" onClick={onClose} data-testid="button-cancel-mailing">
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving} data-testid="button-save-mailing">
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : null}
              {isEdit ? "Save Changes" : "Create Mailing"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
