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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  Plus, Pencil, Trash2, TicketIcon, Loader2, MoreVertical,
  ChevronUp, ChevronDown, ChevronsUpDown, User, Building2, Search,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type EnrichedTicket = Ticket & { associationName: string; associationColor: string };

const PRIORITY_COLORS: Record<string, string> = {
  urgent: "#DC2626", high: "#EA580C", medium: "#D97706", low: "#6B7280",
};
const STATUS_COLORS: Record<string, string> = {
  open: "#3B82F6", in_progress: "#8B5CF6", review: "#F59E0B", done: "#22C55E",
};
const STATUS_LABELS: Record<string, string> = {
  open: "Open", in_progress: "In Progress", review: "Review", done: "Done",
};
const PRIORITY_LABELS: Record<string, string> = {
  urgent: "Urgent", high: "High", medium: "Medium", low: "Low",
};
const PRIORITY_ORDER: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };
const STATUS_ORDER: Record<string, number> = { open: 0, in_progress: 1, review: 2, done: 3 };

function PriorityBadge({ priority }: { priority: string }) {
  const color = PRIORITY_COLORS[priority] ?? "#6B7280";
  return (
    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide"
      style={{ backgroundColor: `${color}20`, color }}>
      {PRIORITY_LABELS[priority] ?? priority}
    </span>
  );
}
function StatusBadge({ status }: { status: string }) {
  const color = STATUS_COLORS[status] ?? "#6B7280";
  return (
    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide"
      style={{ backgroundColor: `${color}20`, color }}>
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

export default function AdminGlobalTicketsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const isSuperAdmin = user?.role === "super_admin";
  // For non-admins: can only submit tickets, not manage
  const canManageAll = isSuperAdmin;
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("active");
  const [assocFilter, setAssocFilter] = useState<string>("all");
  const [submitting, setSubmitting] = useState<string | null>(null); // assocId to submit to

  const { data: tickets = [], isLoading } = useQuery<EnrichedTicket[]>({
    queryKey: ["/api/global/tickets"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/global/tickets");
      return res.json();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => { await apiRequest("DELETE", `/api/tickets/item/${id}`); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/global/tickets"] });
      toast({ title: "Ticket deleted" });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      await apiRequest("PATCH", `/api/tickets/item/${id}`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/global/tickets"] });
    },
  });

  // Unique associations from tickets
  const associations = useMemo(() => {
    const map = new Map<string, { id: string; name: string; color: string }>();
    for (const t of tickets) {
      if (!map.has(t.associationId)) {
        map.set(t.associationId, { id: t.associationId, name: t.associationName, color: t.associationColor });
      }
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [tickets]);

  const filtered = useMemo(() => {
    let list = tickets;
    if (statusFilter === "active") {
      list = list.filter((t) => t.status !== "done");
    } else if (statusFilter !== "all") {
      list = list.filter((t) => t.status === statusFilter);
    }
    if (assocFilter !== "all") {
      list = list.filter((t) => t.associationId === assocFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((t) =>
        t.title.toLowerCase().includes(q) ||
        t.description?.toLowerCase().includes(q) ||
        t.associationName.toLowerCase().includes(q)
      );
    }
    return list;
  }, [tickets, statusFilter, assocFilter, searchQuery]);

  // Stats
  const totalOpen = tickets.filter((t) => t.status === "open").length;
  const totalInProgress = tickets.filter((t) => t.status === "in_progress").length;
  const totalReview = tickets.filter((t) => t.status === "review").length;

  type SortKey = "title" | "priority" | "status" | "association" | "createdAt";
  type SortDir = "asc" | "desc";
  const [sortKey, setSortKey] = useState<SortKey>("createdAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  }

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let cmp = 0;
      if (sortKey === "title") cmp = a.title.localeCompare(b.title);
      else if (sortKey === "priority") cmp = (PRIORITY_ORDER[a.priority] ?? 99) - (PRIORITY_ORDER[b.priority] ?? 99);
      else if (sortKey === "status") cmp = (STATUS_ORDER[a.status] ?? 99) - (STATUS_ORDER[b.status] ?? 99);
      else if (sortKey === "association") cmp = a.associationName.localeCompare(b.associationName);
      else if (sortKey === "createdAt") cmp = a.createdAt.localeCompare(b.createdAt);
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [filtered, sortKey, sortDir]);

  function SortIcon({ col }: { col: SortKey }) {
    if (sortKey !== col) return <ChevronsUpDown className="w-3 h-3 ml-1 opacity-40" />;
    return sortDir === "asc" ? <ChevronUp className="w-3 h-3 ml-1" /> : <ChevronDown className="w-3 h-3 ml-1" />;
  }

  if (isLoading) {
    return (<div className="flex flex-col gap-3 p-6">{[1, 2, 3].map((i) => (<Skeleton key={i} className="h-14 rounded-lg" />))}</div>);
  }

  return (
    <div className="p-6 max-w-7xl">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-bold" data-testid="text-global-tickets-heading">
            All Tickets
          </h2>
          <p className="text-sm text-muted-foreground">
            {tickets.length} total · {totalOpen} open · {totalInProgress} in progress · {totalReview} in review
          </p>
        </div>
        {/* Submit-a-ticket dropdown (available to all users) */}
        {associations.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" data-testid="button-submit-ticket">
                <Plus className="w-4 h-4 mr-1.5" /> Submit Ticket
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              {associations.map((a) => (
                <DropdownMenuItem key={a.id} onClick={() => setSubmitting(a.id)} data-testid={`menu-submit-to-${a.id}`}>
                  <div className="w-2 h-2 rounded-full mr-2 flex-shrink-0" style={{ backgroundColor: a.color }} />
                  {a.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input placeholder="Search tickets..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 h-9 text-sm" data-testid="input-search-global-tickets" />
        </div>
        <Select value={assocFilter} onValueChange={setAssocFilter}>
          <SelectTrigger className="w-[200px] h-9 text-sm" data-testid="select-assoc-filter">
            <SelectValue placeholder="All Associations" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Associations</SelectItem>
            {associations.map((a) => (
              <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Tabs value={statusFilter} onValueChange={setStatusFilter}>
          <TabsList className="h-9">
            <TabsTrigger value="active" className="text-xs px-3">Active</TabsTrigger>
            <TabsTrigger value="all" className="text-xs px-3">All</TabsTrigger>
            <TabsTrigger value="done" className="text-xs px-3">Done</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Table */}
      {sorted.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground" data-testid="empty-global-tickets">
          <TicketIcon className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm font-medium">No tickets found</p>
          <p className="text-xs mt-1">Submit a ticket or adjust filters.</p>
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden" data-testid="global-tickets-table">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b">
              <tr>
                {([
                  { key: "association" as SortKey, label: "Association" },
                  { key: "title" as SortKey, label: "Title" },
                  { key: "priority" as SortKey, label: "Priority" },
                  { key: "status" as SortKey, label: "Status" },
                  { key: "createdAt" as SortKey, label: "Created" },
                ]).map(({ key, label }) => (
                  <th key={key} onClick={() => handleSort(key)}
                    className="px-4 py-2.5 text-left font-medium text-muted-foreground text-xs cursor-pointer hover:text-foreground select-none">
                    <span className="inline-flex items-center">{label}<SortIcon col={key} /></span>
                  </th>
                ))}
                {canManageAll && (
                  <th className="px-4 py-2.5 text-right font-medium text-muted-foreground text-xs">Actions</th>
                )}
              </tr>
            </thead>
            <tbody>
              {sorted.map((ticket, idx) => (
                <tr key={ticket.id}
                  className={`border-b last:border-0 hover:bg-muted/30 transition-colors ${idx % 2 === 0 ? "" : "bg-muted/10"}`}
                  data-testid={`row-global-ticket-${ticket.id}`}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: ticket.associationColor }} />
                      <span className="text-xs font-medium truncate max-w-[140px]">{ticket.associationName}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-medium max-w-[250px]">
                    <span className="truncate block">{ticket.title}</span>
                    {ticket.description && (
                      <span className="text-[11px] text-muted-foreground truncate block">{ticket.description}</span>
                    )}
                  </td>
                  <td className="px-4 py-3"><PriorityBadge priority={ticket.priority} /></td>
                  <td className="px-4 py-3"><StatusBadge status={ticket.status} /></td>
                  <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(ticket.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </td>
                  {canManageAll && (
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                              <MoreVertical className="w-3.5 h-3.5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-44">
                            {TICKET_STATUSES.filter((s) => s !== ticket.status).map((s) => (
                              <DropdownMenuItem key={s} onClick={() => updateStatusMutation.mutate({ id: ticket.id, status: s })}>
                                <span className="w-2 h-2 rounded-full mr-2 flex-shrink-0" style={{ backgroundColor: STATUS_COLORS[s] }} />
                                Move to {STATUS_LABELS[s]}
                              </DropdownMenuItem>
                            ))}
                            <DropdownMenuItem className="text-destructive focus:text-destructive"
                              onClick={() => { if (confirm("Delete this ticket?")) deleteMutation.mutate(ticket.id); }}>
                              <Trash2 className="w-3.5 h-3.5 mr-2" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {submitting && (
        <SubmitTicketDialog associationId={submitting} onClose={() => setSubmitting(null)} />
      )}
    </div>
  );
}

function SubmitTicketDialog({ associationId, onClose }: { associationId: string; onClose: () => void }) {
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("medium");
  const [saving, setSaving] = useState(false);

  async function handleSubmit() {
    if (!title.trim()) { toast({ title: "Title is required", variant: "destructive" }); return; }
    setSaving(true);
    try {
      await apiRequest("POST", `/api/tickets/${associationId}`, {
        associationId, title, description, priority, status: "open",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/global/tickets"] });
      toast({ title: "Ticket submitted" });
      onClose();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally { setSaving(false); }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle data-testid="text-submit-ticket-title">Submit a Ticket</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4 mt-2">
          <div className="flex flex-col gap-1.5">
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Brief description of the issue"
              data-testid="input-submit-ticket-title" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)}
              placeholder="Provide more details..." rows={3} data-testid="input-submit-ticket-description" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Priority</Label>
            <Select value={priority} onValueChange={setPriority}>
              <SelectTrigger data-testid="select-submit-ticket-priority"><SelectValue /></SelectTrigger>
              <SelectContent>
                {TICKET_PRIORITIES.map((p) => (<SelectItem key={p} value={p}>{PRIORITY_LABELS[p]}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end gap-2 mt-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={saving} data-testid="button-confirm-submit-ticket">
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : null}
              Submit Ticket
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
