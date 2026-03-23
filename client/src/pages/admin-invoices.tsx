import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import type { Invoice } from "@shared/schema";
import { INVOICE_STATUSES } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, ChevronDown, ChevronRight, Loader2, FileText, X, Wand2 } from "lucide-react";

type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

const STATUS_COLORS: Record<InvoiceStatus, string> = {
  uploaded: "#6B7280",
  processing: "#3B82F6",
  review: "#F59E0B",
  approved: "#22C55E",
  rejected: "#DC2626",
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

function StatusBadge({ status }: { status: InvoiceStatus }) {
  const color = STATUS_COLORS[status] ?? "#6B7280";
  const label = status.charAt(0).toUpperCase() + status.slice(1);
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium text-white"
      style={{ backgroundColor: color }}
    >
      {label}
    </span>
  );
}

const MOCK_LINE_ITEM_DESCS = ["Service charge", "Materials", "Labor", "Tax", "Delivery", "Installation", "Maintenance", "Supplies"];

function generateMockLineItems(total: number) {
  const count = Math.floor(Math.random() * 3) + 2; // 2-4
  const items = [];
  let remaining = total;
  for (let i = 0; i < count; i++) {
    const isLast = i === count - 1;
    const amount = isLast
      ? Math.round(remaining * 100) / 100
      : Math.round((remaining * (0.2 + Math.random() * 0.4)) * 100) / 100;
    remaining -= amount;
    items.push({
      description: MOCK_LINE_ITEM_DESCS[i % MOCK_LINE_ITEM_DESCS.length],
      amount,
      category: "General",
      glCode: `GL-${1000 + i}`,
    });
  }
  return items;
}

export default function AdminInvoicesPage({ associationId }: { associationId: string }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Invoice | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [simulating, setSimulating] = useState<string | null>(null);

  const canManage = user?.role === "super_admin" || user?.associations?.some(
    (a) => a.associationId === associationId && a.permission === "manage"
  );

  const { data: invoices = [], isLoading } = useQuery<Invoice[]>({
    queryKey: ["/api/invoices", associationId],
    enabled: !!associationId,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/invoices/item/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices", associationId] });
      toast({ title: "Invoice deleted" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  async function simulateAISplit(invoice: Invoice) {
    setSimulating(invoice.id);
    try {
      const mockItems = invoice.lineItems.length > 0
        ? invoice.lineItems
        : generateMockLineItems(invoice.totalAmount);
      await apiRequest("PATCH", `/api/invoices/item/${invoice.id}`, {
        status: "review",
        lineItems: mockItems,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/invoices", associationId] });
      // Auto-expand the invoice to show results
      setExpanded((prev) => { const next = new Set(prev); next.add(invoice.id); return next; });
      toast({ title: "AI split complete", description: "Invoice moved to review with line items." });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSimulating(null);
    }
  }

  function toggleExpanded(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const stats = useMemo(() => ({
    total: invoices.length,
    pendingReview: invoices.filter((i) => i.status === "review").length,
    totalValue: invoices.reduce((sum, i) => sum + i.totalAmount, 0),
  }), [invoices]);

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
          <h2 className="text-lg font-bold" data-testid="text-invoices-heading">Invoices</h2>
          <p className="text-sm text-muted-foreground">{invoices.length} invoice{invoices.length !== 1 ? "s" : ""}</p>
        </div>
        {canManage && (
          <Button onClick={() => setCreating(true)} size="sm" data-testid="button-create-invoice">
            <Plus className="w-4 h-4 mr-1.5" />
            New Invoice
          </Button>
        )}
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-3 mb-5" data-testid="invoices-stats-row">
        <Card data-testid="stat-total-invoices">
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground mb-1">Total Invoices</p>
            <p className="text-lg font-bold">{stats.total}</p>
          </CardContent>
        </Card>
        <Card data-testid="stat-pending-review">
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground mb-1">Pending Review</p>
            <p className="text-lg font-bold text-amber-600">{stats.pendingReview}</p>
          </CardContent>
        </Card>
        <Card data-testid="stat-total-value">
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground mb-1">Total Value</p>
            <p className="text-lg font-bold">{formatCurrency(stats.totalValue)}</p>
          </CardContent>
        </Card>
      </div>

      {invoices.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground" data-testid="empty-invoices">
          <FileText className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm font-medium">No invoices yet</p>
          <p className="text-xs mt-1">Upload your first invoice to get started.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {invoices.map((invoice) => {
            const isOpen = expanded.has(invoice.id);
            const lineItemTotal = invoice.lineItems.reduce((sum, li) => sum + li.amount, 0);

            return (
              <Card key={invoice.id} className="hover:shadow-sm transition-shadow" data-testid={`card-invoice-${invoice.id}`}>
                <CardContent className="p-4">
                  {/* Header row */}
                  <div className="flex items-start gap-3">
                    <button
                      onClick={() => toggleExpanded(invoice.id)}
                      className="mt-0.5 text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
                      data-testid={`button-expand-invoice-${invoice.id}`}
                    >
                      {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span
                          className="font-semibold text-sm cursor-pointer"
                          onClick={() => toggleExpanded(invoice.id)}
                          data-testid={`text-invoice-vendor-${invoice.id}`}
                        >
                          {invoice.vendor}
                        </span>
                        {invoice.invoiceNumber && (
                          <span className="text-xs text-muted-foreground">#{invoice.invoiceNumber}</span>
                        )}
                        <StatusBadge status={invoice.status} />
                        <span className="text-xs text-muted-foreground" data-testid={`text-invoice-line-count-${invoice.id}`}>
                          {invoice.lineItems.length} line item{invoice.lineItems.length !== 1 ? "s" : ""}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span data-testid={`text-invoice-date-${invoice.id}`}>
                          {formatDate(invoice.invoiceDate)}
                        </span>
                        <span className="font-semibold text-foreground" data-testid={`text-invoice-total-${invoice.id}`}>
                          {formatCurrency(invoice.totalAmount)}
                        </span>
                        {invoice.notes && (
                          <span className="truncate max-w-[200px]">{invoice.notes}</span>
                        )}
                      </div>
                    </div>
                    {canManage && (
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {invoice.status === "uploaded" && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs gap-1"
                            onClick={() => simulateAISplit(invoice)}
                            disabled={simulating === invoice.id}
                            data-testid={`button-ai-split-${invoice.id}`}
                          >
                            {simulating === invoice.id ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <Wand2 className="w-3 h-3" />
                            )}
                            AI Split
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={() => setEditing(invoice)}
                          data-testid={`button-edit-invoice-${invoice.id}`}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                          onClick={() => {
                            if (confirm("Delete this invoice?")) deleteMutation.mutate(invoice.id);
                          }}
                          data-testid={`button-delete-invoice-${invoice.id}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Expanded line items */}
                  {isOpen && (
                    <div className="mt-3 ml-7" data-testid={`line-items-${invoice.id}`}>
                      {invoice.lineItems.length === 0 ? (
                        <p className="text-xs text-muted-foreground italic">No line items. Use AI Split to generate them.</p>
                      ) : (
                        <div className="overflow-x-auto rounded-md border">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="border-b bg-muted/30">
                                <th className="text-left p-2 font-semibold text-muted-foreground">Description</th>
                                <th className="text-right p-2 font-semibold text-muted-foreground">Amount</th>
                                <th className="text-left p-2 font-semibold text-muted-foreground">Category</th>
                                <th className="text-left p-2 font-semibold text-muted-foreground">GL Code</th>
                              </tr>
                            </thead>
                            <tbody>
                              {invoice.lineItems.map((li) => (
                                <tr key={li.id} className="border-b last:border-0 hover:bg-muted/20" data-testid={`line-item-row-${li.id}`}>
                                  <td className="p-2">{li.description}</td>
                                  <td className="p-2 text-right font-medium">{formatCurrency(li.amount)}</td>
                                  <td className="p-2 text-muted-foreground">{li.category || "—"}</td>
                                  <td className="p-2 text-muted-foreground font-mono">{li.glCode || "—"}</td>
                                </tr>
                              ))}
                              {/* Subtotal row */}
                              <tr className="bg-muted/30 font-semibold" data-testid={`line-items-subtotal-${invoice.id}`}>
                                <td className="p-2 text-xs">Subtotal</td>
                                <td className="p-2 text-right text-xs">{formatCurrency(lineItemTotal)}</td>
                                <td className="p-2" />
                                <td className="p-2" />
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {creating && (
        <InvoiceDialog
          invoice={null}
          associationId={associationId}
          onClose={() => setCreating(false)}
        />
      )}
      {editing && (
        <InvoiceDialog
          invoice={editing}
          associationId={associationId}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

interface LineItemDraft {
  description: string;
  amount: string;
  category: string;
  glCode: string;
}

function InvoiceDialog({
  invoice,
  associationId,
  onClose,
}: {
  invoice: Invoice | null;
  associationId: string;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const isEdit = !!invoice;
  const [vendor, setVendor] = useState(invoice?.vendor || "");
  const [invoiceNumber, setInvoiceNumber] = useState(invoice?.invoiceNumber || "");
  const [invoiceDate, setInvoiceDate] = useState(invoice?.invoiceDate || new Date().toISOString().slice(0, 10));
  const [totalAmount, setTotalAmount] = useState<string>(invoice ? String(invoice.totalAmount) : "");
  const [status, setStatus] = useState<InvoiceStatus>(invoice?.status || "uploaded");
  const [notes, setNotes] = useState(invoice?.notes || "");
  const [lineItems, setLineItems] = useState<LineItemDraft[]>(
    invoice?.lineItems.length
      ? invoice.lineItems.map((li) => ({
          description: li.description,
          amount: String(li.amount),
          category: li.category || "",
          glCode: li.glCode || "",
        }))
      : []
  );
  const [saving, setSaving] = useState(false);

  function addLineItem() {
    setLineItems((prev) => [...prev, { description: "", amount: "", category: "", glCode: "" }]);
  }

  function removeLineItem(index: number) {
    setLineItems((prev) => prev.filter((_, i) => i !== index));
  }

  function updateLineItem(index: number, field: keyof LineItemDraft, value: string) {
    setLineItems((prev) => prev.map((li, i) => (i === index ? { ...li, [field]: value } : li)));
  }

  async function handleSave() {
    if (!vendor.trim()) {
      toast({ title: "Vendor is required", variant: "destructive" });
      return;
    }
    const totalAmountNum = parseFloat(totalAmount);
    if (isNaN(totalAmountNum) || totalAmountNum < 0) {
      toast({ title: "Valid total amount is required", variant: "destructive" });
      return;
    }
    const validLineItems = lineItems
      .filter((li) => li.description.trim())
      .map((li) => ({
        description: li.description.trim(),
        amount: parseFloat(li.amount) || 0,
        category: li.category.trim() || undefined,
        glCode: li.glCode.trim() || undefined,
      }));

    setSaving(true);
    try {
      const payload = {
        vendor: vendor.trim(),
        invoiceNumber: invoiceNumber.trim() || undefined,
        invoiceDate,
        totalAmount: totalAmountNum,
        status,
        lineItems: validLineItems,
        notes: notes.trim() || undefined,
      };
      if (isEdit) {
        await apiRequest("PATCH", `/api/invoices/item/${invoice.id}`, payload);
      } else {
        await apiRequest("POST", `/api/invoices/${associationId}`, {
          ...payload,
          associationId,
        });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/invoices", associationId] });
      toast({ title: isEdit ? "Invoice updated" : "Invoice created" });
      onClose();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle data-testid="text-invoice-dialog-title">
            {isEdit ? "Edit Invoice" : "New Invoice"}
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4 mt-2">
          {/* Vendor + Invoice Number */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>Vendor</Label>
              <Input
                value={vendor}
                onChange={(e) => setVendor(e.target.value)}
                placeholder="e.g. ABC Landscaping"
                data-testid="input-invoice-vendor"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Invoice Number</Label>
              <Input
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                placeholder="e.g. INV-001"
                data-testid="input-invoice-number"
              />
            </div>
          </div>

          {/* Date + Amount + Status */}
          <div className="grid grid-cols-3 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>Invoice Date</Label>
              <Input
                type="date"
                value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)}
                data-testid="input-invoice-date"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Total Amount ($)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={totalAmount}
                onChange={(e) => setTotalAmount(e.target.value)}
                placeholder="0.00"
                data-testid="input-invoice-total"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as InvoiceStatus)}>
                <SelectTrigger data-testid="select-invoice-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {INVOICE_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s.charAt(0).toUpperCase() + s.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Notes */}
          <div className="flex flex-col gap-1.5">
            <Label>Notes</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes"
              rows={2}
              data-testid="input-invoice-notes"
            />
          </div>

          {/* Line items */}
          <div className="flex flex-col gap-2">
            <Label>Line Items</Label>
            {lineItems.length > 0 && (
              <div className="flex flex-col gap-2" data-testid="invoice-line-items-list">
                {lineItems.map((li, index) => (
                  <div key={index} className="grid grid-cols-[1fr_100px_120px_100px_auto] gap-2 items-center" data-testid={`line-item-draft-${index}`}>
                    <Input
                      value={li.description}
                      onChange={(e) => updateLineItem(index, "description", e.target.value)}
                      placeholder="Description"
                      className="h-8 text-xs"
                      data-testid={`input-line-desc-${index}`}
                    />
                    <Input
                      type="number"
                      value={li.amount}
                      onChange={(e) => updateLineItem(index, "amount", e.target.value)}
                      placeholder="Amount"
                      className="h-8 text-xs"
                      data-testid={`input-line-amount-${index}`}
                    />
                    <Input
                      value={li.category}
                      onChange={(e) => updateLineItem(index, "category", e.target.value)}
                      placeholder="Category"
                      className="h-8 text-xs"
                      data-testid={`input-line-category-${index}`}
                    />
                    <Input
                      value={li.glCode}
                      onChange={(e) => updateLineItem(index, "glCode", e.target.value)}
                      placeholder="GL Code"
                      className="h-8 text-xs font-mono"
                      data-testid={`input-line-glcode-${index}`}
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive flex-shrink-0"
                      onClick={() => removeLineItem(index)}
                      data-testid={`button-remove-line-${index}`}
                    >
                      <X className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
            <Button
              variant="outline"
              size="sm"
              className="self-start gap-1.5 mt-1"
              onClick={addLineItem}
              data-testid="button-add-line-item"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Line Item
            </Button>
          </div>

          <div className="flex justify-end gap-2 mt-2">
            <Button variant="outline" onClick={onClose} data-testid="button-cancel-invoice">
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving} data-testid="button-save-invoice">
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : null}
              {isEdit ? "Save Changes" : "Create Invoice"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
