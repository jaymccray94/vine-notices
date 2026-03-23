import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import type { Ticket } from "@shared/schema";
import { TICKET_STATUSES, TICKET_PRIORITIES } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import {
  Plus,
  Pencil,
  Trash2,
  TicketIcon,
  Loader2,
  MoreVertical,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  User,
} from "lucide-react";

// ── Color maps ──────────────────────────────────────────────────────────────

const PRIORITY_COLORS: Record<string, string> = {
  urgent: "#DC2626",
  high: "#EA580C",
  medium: "#D97706",
  low: "#6B7280",
};

const STATUS_COLORS: Record<string, string> = {
  open: "#3B82F6",
  in_progress: "#8B5CF6",
  review: "#F59E0B",
  done: "#22C55E",
};

const STATUS_LABELS: Record<string, string> = {
  open: "Open",
  in_progress: "In Progress",
  review: "Review",
  done: "Done",
};

const PRIORITY_LABELS: Record<string, string> = {
  urgent: "Urgent",
  high: "High",
  medium: "Medium",
  low: "Low",
};

const KANBAN_COLUMNS: Array<{ status: string; label: string }> = [
  { status: "open", label: "Open" },
  { status: "in_progress", label: "In Progress" },
  { status: "review", label: "Review" },
  { status: "done", label: "Done" },
];

function PriorityBadge({ priority }: { priority: string }) {
  const color = PRIORITY_COLORS[priority] ?? "#6B7280";
  return (
    <span
      className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide"
      style={{ backgroundColor: `${color}20`, color }}
      data-testid={`badge-priority-${priority}`}
    >
      {PRIORITY_LABELS[priority] ?? priority}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const color = STATUS_COLORS[status] ?? "#6B7280";
  return (
    <span
      className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide"
      style={{ backgroundColor: `${color}20`, color }}
      data-testid={`badge-status-${status}`}
    >
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────

export default function AdminTicketsPage({ associationId }: { associationId: string }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [editing, setEditing] = useState<Ticket | null>(null);
  const [creating, setCreating] = useState(false);
  const canManage =
    user?.role === "super_admin" ||
    user?.associations?.some(
      (a) => a.associationId === associationId && a.permission === "manage"
    );

  const { data: tickets = [], isLoading } = useQuery<Ticket[]>({
    queryKey: ["/api/tickets", associationId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/tickets/${associationId}`);
      return res.json();
    },
    enabled: !!associationId,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/tickets/item/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tickets", associationId] });
      toast({ title: "Ticket deleted" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      await apiRequest("PATCH", `/api/tickets/item/${id}`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tickets", associationId] });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3 p-6">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-20 rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-bold" data-testid="text-tickets-heading">
            Tickets
          </h2>
          <p className="text-sm text-muted-foreground">
            {tickets.length} ticket{tickets.length !== 1 ? "s" : ""}
          </p>
        </div>
        {canManage && (
          <Button
            onClick={() => setCreating(true)}
            size="sm"
            data-testid="button-create-ticket"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            New Ticket
          </Button>
        )}
      </div>

      <Tabs defaultValue="kanban" data-testid="tabs-view">
        <TabsList className="mb-4">
          <TabsTrigger value="kanban" data-testid="tab-kanban">
            Kanban
          </TabsTrigger>
          <TabsTrigger value="list" data-testid="tab-list">
            List
          </TabsTrigger>
        </TabsList>

        <TabsContent value="kanban">
          <KanbanView
            tickets={tickets}
            canManage={canManage}
            onEdit={setEditing}
            onDelete={(id) => {
              if (confirm("Delete this ticket?")) deleteMutation.mutate(id);
            }}
            onStatusChange={(id, status) =>
              updateStatusMutation.mutate({ id, status })
            }
          />
        </TabsContent>

        <TabsContent value="list">
          <ListView
            tickets={tickets}
            canManage={canManage}
            onEdit={setEditing}
            onDelete={(id) => {
              if (confirm("Delete this ticket?")) deleteMutation.mutate(id);
            }}
          />
        </TabsContent>
      </Tabs>

      {(creating || editing) && (
        <TicketDialog
          ticket={editing}
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

// ── Kanban View ─────────────────────────────────────────────────────────────

function KanbanView({
  tickets,
  canManage,
  onEdit,
  onDelete,
  onStatusChange,
}: {
  tickets: Ticket[];
  canManage: boolean | undefined;
  onEdit: (ticket: Ticket) => void;
  onDelete: (id: string) => void;
  onStatusChange: (id: string, status: string) => void;
}) {
  if (tickets.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground" data-testid="empty-tickets">
        <TicketIcon className="w-10 h-10 mx-auto mb-3 opacity-40" />
        <p className="text-sm font-medium">No tickets yet</p>
        <p className="text-xs mt-1">Create your first ticket to get started.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4" data-testid="kanban-board">
      {KANBAN_COLUMNS.map(({ status, label }) => {
        const col = tickets.filter((t) => t.status === status);
        const headerColor = STATUS_COLORS[status];
        return (
          <div key={status} className="flex flex-col gap-2" data-testid={`kanban-column-${status}`}>
            <div className="flex items-center justify-between px-1 pb-1 border-b">
              <div className="flex items-center gap-2">
                <span
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: headerColor }}
                />
                <span className="text-sm font-semibold">{label}</span>
              </div>
              <span
                className="text-xs font-medium px-1.5 py-0.5 rounded-full"
                style={{ backgroundColor: `${headerColor}20`, color: headerColor }}
                data-testid={`kanban-count-${status}`}
              >
                {col.length}
              </span>
            </div>

            <div className="flex flex-col gap-2 min-h-[120px]">
              {col.map((ticket) => (
                <KanbanCard
                  key={ticket.id}
                  ticket={ticket}
                  canManage={canManage}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  onStatusChange={onStatusChange}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function KanbanCard({
  ticket,
  canManage,
  onEdit,
  onDelete,
  onStatusChange,
}: {
  ticket: Ticket;
  canManage: boolean | undefined;
  onEdit: (ticket: Ticket) => void;
  onDelete: (id: string) => void;
  onStatusChange: (id: string, status: string) => void;
}) {
  return (
    <Card
      className="hover:shadow-sm transition-shadow"
      data-testid={`kanban-card-${ticket.id}`}
    >
      <CardContent className="p-3">
        <div className="flex items-start justify-between gap-2 mb-1.5">
          <span className="font-medium text-sm leading-snug line-clamp-2 flex-1">
            {ticket.title}
          </span>
          {canManage && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 flex-shrink-0"
                  data-testid={`button-card-menu-${ticket.id}`}
                >
                  <MoreVertical className="w-3.5 h-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuItem
                  onClick={() => onEdit(ticket)}
                  data-testid={`menu-edit-${ticket.id}`}
                >
                  <Pencil className="w-3.5 h-3.5 mr-2" /> Edit
                </DropdownMenuItem>
                {TICKET_STATUSES.filter((s) => s !== ticket.status).map((s) => (
                  <DropdownMenuItem
                    key={s}
                    onClick={() => onStatusChange(ticket.id, s)}
                    data-testid={`menu-move-${ticket.id}-${s}`}
                  >
                    <span
                      className="w-2 h-2 rounded-full mr-2 flex-shrink-0"
                      style={{ backgroundColor: STATUS_COLORS[s] }}
                    />
                    Move to {STATUS_LABELS[s]}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={() => onDelete(ticket.id)}
                  data-testid={`menu-delete-${ticket.id}`}
                >
                  <Trash2 className="w-3.5 h-3.5 mr-2" /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {ticket.description && (
          <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
            {ticket.description}
          </p>
        )}

        <div className="flex items-center justify-between gap-1 flex-wrap">
          <PriorityBadge priority={ticket.priority} />
          {ticket.assignee && (
            <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <User className="w-3 h-3" />
              {ticket.assignee}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ── List View ───────────────────────────────────────────────────────────────

type SortKey = "title" | "priority" | "status" | "assignee" | "createdAt";
type SortDir = "asc" | "desc";

const PRIORITY_ORDER: Record<string, number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
};

const STATUS_ORDER: Record<string, number> = {
  open: 0,
  in_progress: 1,
  review: 2,
  done: 3,
};

function ListView({
  tickets,
  canManage,
  onEdit,
  onDelete,
}: {
  tickets: Ticket[];
  canManage: boolean | undefined;
  onEdit: (ticket: Ticket) => void;
  onDelete: (id: string) => void;
}) {
  const [sortKey, setSortKey] = useState<SortKey>("createdAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  const sorted = useMemo(() => {
    return [...tickets].sort((a, b) => {
      let cmp = 0;
      if (sortKey === "title") {
        cmp = a.title.localeCompare(b.title);
      } else if (sortKey === "priority") {
        cmp = (PRIORITY_ORDER[a.priority] ?? 99) - (PRIORITY_ORDER[b.priority] ?? 99);
      } else if (sortKey === "status") {
        cmp = (STATUS_ORDER[a.status] ?? 99) - (STATUS_ORDER[b.status] ?? 99);
      } else if (sortKey === "assignee") {
        cmp = (a.assignee ?? "").localeCompare(b.assignee ?? "");
      } else if (sortKey === "createdAt") {
        cmp = a.createdAt.localeCompare(b.createdAt);
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [tickets, sortKey, sortDir]);

  if (tickets.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground" data-testid="empty-tickets-list">
        <TicketIcon className="w-10 h-10 mx-auto mb-3 opacity-40" />
        <p className="text-sm font-medium">No tickets yet</p>
        <p className="text-xs mt-1">Create your first ticket to get started.</p>
      </div>
    );
  }

  function SortIcon({ col }: { col: SortKey }) {
    if (sortKey !== col) return <ChevronsUpDown className="w-3 h-3 ml-1 opacity-40" />;
    return sortDir === "asc" ? (
      <ChevronUp className="w-3 h-3 ml-1" />
    ) : (
      <ChevronDown className="w-3 h-3 ml-1" />
    );
  }

  return (
    <div className="border rounded-lg overflow-hidden" data-testid="list-view">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 border-b">
          <tr>
            {(
              [
                { key: "title", label: "Title" },
                { key: "priority", label: "Priority" },
                { key: "status", label: "Status" },
                { key: "assignee", label: "Assignee" },
                { key: "createdAt", label: "Created" },
              ] as { key: SortKey; label: string }[]
            ).map(({ key, label }) => (
              <th
                key={key}
                className="px-4 py-2.5 text-left font-medium text-muted-foreground text-xs cursor-pointer hover:text-foreground select-none"
                onClick={() => handleSort(key)}
                data-testid={`th-${key}`}
              >
                <span className="inline-flex items-center">
                  {label}
                  <SortIcon col={key} />
                </span>
              </th>
            ))}
            {canManage && (
              <th className="px-4 py-2.5 text-right font-medium text-muted-foreground text-xs">
                Actions
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {sorted.map((ticket, idx) => (
            <tr
              key={ticket.id}
              className={`border-b last:border-0 hover:bg-muted/30 transition-colors ${
                idx % 2 === 0 ? "" : "bg-muted/10"
              }`}
              data-testid={`row-ticket-${ticket.id}`}
            >
              <td className="px-4 py-3 font-medium max-w-[220px] truncate">
                {ticket.title}
              </td>
              <td className="px-4 py-3">
                <PriorityBadge priority={ticket.priority} />
              </td>
              <td className="px-4 py-3">
                <StatusBadge status={ticket.status} />
              </td>
              <td className="px-4 py-3 text-muted-foreground text-xs">
                {ticket.assignee ? (
                  <span className="flex items-center gap-1">
                    <User className="w-3 h-3" /> {ticket.assignee}
                  </span>
                ) : (
                  <span className="text-muted-foreground/50">—</span>
                )}
              </td>
              <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                {new Date(ticket.createdAt).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </td>
              {canManage && (
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0"
                      onClick={() => onEdit(ticket)}
                      data-testid={`button-edit-ticket-${ticket.id}`}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                      onClick={() => onDelete(ticket.id)}
                      data-testid={`button-delete-ticket-${ticket.id}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Create / Edit Dialog ────────────────────────────────────────────────────

function TicketDialog({
  ticket,
  associationId,
  onClose,
}: {
  ticket: Ticket | null;
  associationId: string;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const isEdit = !!ticket;
  const [title, setTitle] = useState(ticket?.title ?? "");
  const [description, setDescription] = useState(ticket?.description ?? "");
  const [priority, setPriority] = useState<string>(ticket?.priority ?? "medium");
  const [status, setStatus] = useState<string>(ticket?.status ?? "open");
  const [assignee, setAssignee] = useState(ticket?.assignee ?? "");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!title.trim()) {
      toast({ title: "Title is required", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      if (isEdit) {
        await apiRequest("PATCH", `/api/tickets/item/${ticket.id}`, {
          title,
          description,
          priority,
          status,
          assignee: assignee || undefined,
        });
      } else {
        await apiRequest("POST", `/api/tickets/${associationId}`, {
          associationId,
          title,
          description,
          priority,
          status,
          assignee: assignee || undefined,
        });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/tickets", associationId] });
      toast({ title: isEdit ? "Ticket updated" : "Ticket created" });
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
          <DialogTitle data-testid="text-ticket-dialog-title">
            {isEdit ? "Edit Ticket" : "New Ticket"}
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4 mt-2">
          <div className="flex flex-col gap-1.5">
            <Label>Title</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Brief description of the issue"
              data-testid="input-ticket-title"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Description</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Provide more details..."
              rows={3}
              data-testid="input-ticket-description"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>Priority</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger data-testid="select-ticket-priority">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TICKET_PRIORITIES.map((p) => (
                    <SelectItem key={p} value={p}>
                      {PRIORITY_LABELS[p]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger data-testid="select-ticket-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TICKET_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {STATUS_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Assignee</Label>
            <Input
              value={assignee}
              onChange={(e) => setAssignee(e.target.value)}
              placeholder="Name or email (optional)"
              data-testid="input-ticket-assignee"
            />
          </div>

          <div className="flex justify-end gap-2 mt-2">
            <Button variant="outline" onClick={onClose} data-testid="button-cancel-ticket">
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving} data-testid="button-save-ticket">
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : null}
              {isEdit ? "Save Changes" : "Create Ticket"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
