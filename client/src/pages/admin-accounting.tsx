import { EmptyState } from "@/components/empty-state";
import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import type { AccountingItem } from "@shared/schema";
import { ACCOUNTING_STATUSES, ACCOUNTING_TYPES } from "@shared/schema";
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
import { Plus, Pencil, Trash2, DollarSign, Loader2, AlertCircle } from "lucide-react";

type AccountingStatus = (typeof ACCOUNTING_STATUSES)[number];

const STATUS_TABS = ["all", ...ACCOUNTING_STATUSES] as const;

const STATUS_COLORS: Record<AccountingStatus, string> = {
  outstanding: "#3B82F6",
  partial: "#F59E0B",
  paid: "#22C55E",
  overdue: "#DC2626",
  written_off: "#6B7280",
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}

function formatDate(dateStr: string) {
  if (!dateStr) return "—";
  return new Date(dateStr + "T12:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function isOverdue(item: AccountingItem) {
  if (item.status === "paid" || item.status === "written_off") return false;
  if (!item.dueDate) return false;
  return new Date(item.dueDate) < new Date(new Date().toDateString());
}

function StatusBadge({ status }: { status: AccountingStatus }) {
  const color = STATUS_COLORS[status] ?? "#6B7280";
  const label = status.replace("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium text-white"
      style={{ backgroundColor: color }}
    >
      {label}
    </span>
  );
}

export default function AdminAccountingPage({ associationId }: { associationId: string }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState<"all" | AccountingStatus>("all");
  const [editing, setEditing] = useState<AccountingItem | null>(null);
  const [creating, setCreating] = useState(false);

  const canManage = user?.role === "super_admin" || user?.associations?.some(
    (a) => a.associationId === associationId && a.permission === "manage"
  );

  const { data: items = [], isLoading } = useQuery<AccountingItem[]>({
    queryKey: ["/api/accounting", associationId],
    enabled: !!associationId,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/accounting/item/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/accounting", associationId] });
      toast({ title: "Item deleted" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  // Summary stats
  const stats = useMemo(() => {
    const totalOutstanding = items
      .filter((i) => i.status === "outstanding" || i.status === "partial" || i.status === "overdue")
      .reduce((sum, i) => sum + (i.amount - i.amountPaid), 0);
    const overdueCount = items.filter(isOverdue).length;
    const paidThisPeriod = items
      .filter((i) => i.status === "paid")
      .reduce((sum, i) => sum + i.amountPaid, 0);
    return { totalOutstanding, overdueCount, paidThisPeriod, totalItems: items.length };
  }, [items]);

  const filtered = useMemo(() => {
    if (statusFilter === "all") return items;
    if (statusFilter === "overdue") return items.filter(isOverdue);
    return items.filter((i) => i.status === statusFilter);
  }, [items, statusFilter]);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3 p-6">
        <div className="grid grid-cols-4 gap-3 mb-2">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-20 rounded-lg" />)}
        </div>
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 rounded-lg" />)}
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-bold" data-testid="text-accounting-heading">Accounting</h2>
          <p className="text-sm text-muted-foreground">{items.length} item{items.length !== 1 ? "s" : ""}</p>
        </div>
        {canManage && (
          <Button onClick={() => setCreating(true)} size="sm" data-testid="button-create-accounting">
            <Plus className="w-4 h-4 mr-1.5" />
            New Item
          </Button>
        )}
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5" data-testid="stats-row">
        <Card data-testid="stat-total-outstanding">
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground mb-1">Total Outstanding</p>
            <p className="text-lg font-bold text-blue-600">{formatCurrency(stats.totalOutstanding)}</p>
          </CardContent>
        </Card>
        <Card data-testid="stat-overdue-count">
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground mb-1">Overdue Items</p>
            <p className="text-lg font-bold text-red-600">{stats.overdueCount}</p>
          </CardContent>
        </Card>
        <Card data-testid="stat-paid-period">
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground mb-1">Paid This Period</p>
            <p className="text-lg font-bold text-green-600">{formatCurrency(stats.paidThisPeriod)}</p>
          </CardContent>
        </Card>
        <Card data-testid="stat-total-items">
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground mb-1">Total Items</p>
            <p className="text-lg font-bold">{stats.totalItems}</p>
          </CardContent>
        </Card>
      </div>

      {/* Status filter tabs */}
      <div className="flex items-center gap-1 bg-muted rounded-lg p-0.5 mb-4 flex-wrap" data-testid="status-tabs">
        {STATUS_TABS.map((tab) => {
          const label = tab === "all" ? "All" : tab.replace("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
          return (
            <button
              key={tab}
              onClick={() => setStatusFilter(tab as typeof statusFilter)}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                statusFilter === tab
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              data-testid={`tab-status-${tab}`}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground" data-testid="empty-accounting">
          <DollarSign className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm font-medium">
            {statusFilter === "all" ? "No accounting items yet" : `No ${statusFilter.replace("_", " ")} items`}
          </p>
          {statusFilter === "all" && (
            <p className="text-xs mt-1">Create your first item to get started.</p>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border" data-testid="accounting-table">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="text-left p-3 text-xs font-semibold text-muted-foreground">Description</th>
                <th className="text-left p-3 text-xs font-semibold text-muted-foreground">Type</th>
                <th className="text-left p-3 text-xs font-semibold text-muted-foreground">Unit</th>
                <th className="text-right p-3 text-xs font-semibold text-muted-foreground">Amount</th>
                <th className="text-right p-3 text-xs font-semibold text-muted-foreground">Paid</th>
                <th className="text-right p-3 text-xs font-semibold text-muted-foreground">Balance</th>
                <th className="text-left p-3 text-xs font-semibold text-muted-foreground">Due Date</th>
                <th className="text-left p-3 text-xs font-semibold text-muted-foreground">Status</th>
                {canManage && <th className="p-3 w-16" />}
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => {
                const balance = item.amount - item.amountPaid;
                const overdue = isOverdue(item);
                return (
                  <tr
                    key={item.id}
                    className={`border-b last:border-0 hover:bg-muted/30 transition-colors ${
                      overdue ? "bg-red-50 dark:bg-red-950/20" : ""
                    }`}
                    data-testid={`row-accounting-${item.id}`}
                  >
                    <td className="p-3">
                      <div className="flex items-center gap-1.5">
                        {overdue && <AlertCircle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />}
                        <span className="font-medium truncate max-w-[180px]" data-testid={`text-description-${item.id}`}>
                          {item.description}
                        </span>
                      </div>
                      {item.notes && (
                        <p className="text-xs text-muted-foreground truncate max-w-[180px]">{item.notes}</p>
                      )}
                    </td>
                    <td className="p-3 text-muted-foreground" data-testid={`text-type-${item.id}`}>{item.type}</td>
                    <td className="p-3 text-muted-foreground" data-testid={`text-unit-${item.id}`}>{item.unit || "—"}</td>
                    <td className="p-3 text-right font-medium" data-testid={`text-amount-${item.id}`}>{formatCurrency(item.amount)}</td>
                    <td className="p-3 text-right text-muted-foreground" data-testid={`text-paid-${item.id}`}>{formatCurrency(item.amountPaid)}</td>
                    <td className="p-3 text-right font-semibold" data-testid={`text-balance-${item.id}`}>
                      {balance > 0 ? formatCurrency(balance) : <span className="text-green-600">—</span>}
                    </td>
                    <td className="p-3 text-muted-foreground whitespace-nowrap" data-testid={`text-due-date-${item.id}`}>
                      {formatDate(item.dueDate)}
                    </td>
                    <td className="p-3" data-testid={`badge-status-${item.id}`}>
                      <StatusBadge status={item.status} />
                    </td>
                    {canManage && (
                      <td className="p-3">
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            onClick={() => setEditing(item)}
                            data-testid={`button-edit-accounting-${item.id}`}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                            onClick={() => {
                              if (confirm("Delete this item?")) deleteMutation.mutate(item.id);
                            }}
                            data-testid={`button-delete-accounting-${item.id}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {(creating || editing) && (
        <AccountingDialog
          item={editing}
          associationId={associationId}
          onClose={() => { setCreating(false); setEditing(null); }}
        />
      )}
    </div>
  );
}

function AccountingDialog({
  item,
  associationId,
  onClose,
}: {
  item: AccountingItem | null;
  associationId: string;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const isEdit = !!item;
  const [description, setDescription] = useState(item?.description || "");
  const [type, setType] = useState<string>(item?.type || ACCOUNTING_TYPES[0]);
  const [amount, setAmount] = useState<string>(item ? String(item.amount) : "");
  const [amountPaid, setAmountPaid] = useState<string>(item ? String(item.amountPaid) : "0");
  const [status, setStatus] = useState<AccountingStatus>(item?.status || "outstanding");
  const [dueDate, setDueDate] = useState(item?.dueDate || new Date().toISOString().slice(0, 10));
  const [unit, setUnit] = useState(item?.unit || "");
  const [notes, setNotes] = useState(item?.notes || "");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!description.trim()) {
      toast({ title: "Description is required", variant: "destructive" });
      return;
    }
    const amountNum = parseFloat(amount);
    const amountPaidNum = parseFloat(amountPaid || "0");
    if (isNaN(amountNum) || amountNum < 0) {
      toast({ title: "Valid amount is required", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        description: description.trim(),
        type,
        amount: amountNum,
        amountPaid: amountPaidNum,
        status,
        dueDate,
        unit: unit.trim() || undefined,
        notes: notes.trim() || undefined,
      };
      if (isEdit) {
        await apiRequest("PATCH", `/api/accounting/item/${item.id}`, payload);
      } else {
        await apiRequest("POST", `/api/accounting/${associationId}`, {
          ...payload,
          associationId,
        });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/accounting", associationId] });
      toast({ title: isEdit ? "Item updated" : "Item created" });
      onClose();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle data-testid="text-accounting-dialog-title">
            {isEdit ? "Edit Accounting Item" : "New Accounting Item"}
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4 mt-2">
          <div className="flex flex-col gap-1.5">
            <Label>Description</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Monthly HOA assessment"
              data-testid="input-accounting-description"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>Type</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger data-testid="select-accounting-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ACCOUNTING_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as AccountingStatus)}>
                <SelectTrigger data-testid="select-accounting-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ACCOUNTING_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s.replace("_", " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>Amount ($)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                data-testid="input-accounting-amount"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Amount Paid ($)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={amountPaid}
                onChange={(e) => setAmountPaid(e.target.value)}
                placeholder="0.00"
                data-testid="input-accounting-amount-paid"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>Due Date</Label>
              <Input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                data-testid="input-accounting-due-date"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Unit / Reference</Label>
              <Input
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder="e.g. Unit 4B"
                data-testid="input-accounting-unit"
              />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Notes</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes"
              rows={2}
              data-testid="input-accounting-notes"
            />
          </div>
          <div className="flex justify-end gap-2 mt-2">
            <Button variant="outline" onClick={onClose} data-testid="button-cancel-accounting">
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving} data-testid="button-save-accounting">
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : null}
              {isEdit ? "Save Changes" : "Create Item"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
