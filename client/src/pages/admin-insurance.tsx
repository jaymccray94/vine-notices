import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import type { InsurancePolicy } from "@shared/schema";
import { COVERAGE_TYPES } from "@shared/schema";
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
import {
  Plus,
  Pencil,
  Trash2,
  ShieldCheck,
  Loader2,
  AlertTriangle,
  Calendar,
  DollarSign,
  Hash,
} from "lucide-react";

// ── Helpers ─────────────────────────────────────────────────────────────────

function formatCurrency(value: number | undefined) {
  if (value == null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(dateStr: string) {
  // Dates are stored as YYYY-MM-DD strings; parse at noon to avoid timezone shifts
  return new Date(dateStr + "T12:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getDaysUntilExpiration(expirationDate: string): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const exp = new Date(expirationDate + "T00:00:00");
  return Math.floor((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function getPolicyStatus(policy: InsurancePolicy): "expired" | "expiring_soon" | "active" {
  const days = getDaysUntilExpiration(policy.expirationDate);
  if (days < 0) return "expired";
  if (days <= 60) return "expiring_soon";
  return "active";
}

// ── Main Page ──────────────────────────────────────────────────────────────

export default function AdminInsurancePage({ associationId }: { associationId: string }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [editing, setEditing] = useState<InsurancePolicy | null>(null);
  const [creating, setCreating] = useState(false);
  const canManage =
    user?.role === "super_admin" ||
    user?.associations?.some(
      (a) => a.associationId === associationId && a.permission === "manage"
    );

  const { data: policies = [], isLoading } = useQuery<InsurancePolicy[]>({
    queryKey: ["/api/insurance", associationId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/insurance/${associationId}`);
      return res.json();
    },
    enabled: !!associationId,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/insurance/item/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/insurance", associationId] });
      toast({ title: "Policy deleted" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  // ── Summary stats ──────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const total = policies.length;
    let active = 0;
    let expiringSoon = 0;
    let totalPremium = 0;
    for (const p of policies) {
      const status = getPolicyStatus(p);
      if (status === "active") active++;
      if (status === "expiring_soon") expiringSoon++;
      if (p.premium != null) totalPremium += p.premium;
    }
    return { total, active, expiringSoon, totalPremium };
  }, [policies]);

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
    <div className="p-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-bold" data-testid="text-insurance-heading">
            Insurance
          </h2>
          <p className="text-sm text-muted-foreground">
            {policies.length} polic{policies.length !== 1 ? "ies" : "y"}
          </p>
        </div>
        {canManage && (
          <Button
            onClick={() => setCreating(true)}
            size="sm"
            data-testid="button-create-policy"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            New Policy
          </Button>
        )}
      </div>

      {/* Summary Stats */}
      {policies.length > 0 && (
        <div
          className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6"
          data-testid="insurance-stats"
        >
          <StatCard
            label="Total Policies"
            value={String(stats.total)}
            testId="stat-total"
          />
          <StatCard
            label="Active"
            value={String(stats.active)}
            valueColor="#22C55E"
            testId="stat-active"
          />
          <StatCard
            label="Expiring Soon"
            value={String(stats.expiringSoon)}
            valueColor={stats.expiringSoon > 0 ? "#F59E0B" : undefined}
            testId="stat-expiring"
          />
          <StatCard
            label="Total Premium"
            value={formatCurrency(stats.totalPremium)}
            testId="stat-premium"
          />
        </div>
      )}

      {/* Empty state */}
      {policies.length === 0 ? (
        <div
          className="text-center py-16 text-muted-foreground"
          data-testid="empty-policies"
        >
          <ShieldCheck className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm font-medium">No insurance policies yet</p>
          <p className="text-xs mt-1">Add your first policy to track coverage.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {policies.map((policy) => (
            <PolicyCard
              key={policy.id}
              policy={policy}
              canManage={canManage}
              onEdit={setEditing}
              onDelete={(id) => {
                if (confirm("Delete this policy?")) deleteMutation.mutate(id);
              }}
            />
          ))}
        </div>
      )}

      {(creating || editing) && (
        <PolicyDialog
          policy={editing}
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

// ── Stat Card ───────────────────────────────────────────────────────────────

function StatCard({
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

// ── Policy Card ─────────────────────────────────────────────────────────────

function PolicyCard({
  policy,
  canManage,
  onEdit,
  onDelete,
}: {
  policy: InsurancePolicy;
  canManage: boolean | undefined;
  onEdit: (p: InsurancePolicy) => void;
  onDelete: (id: string) => void;
}) {
  const policyStatus = getPolicyStatus(policy);
  const daysUntil = getDaysUntilExpiration(policy.expirationDate);

  return (
    <Card
      className="hover:shadow-sm transition-shadow"
      data-testid={`card-policy-${policy.id}`}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          <div className="flex-1 min-w-0">
            {/* Top row: carrier + badges */}
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="font-semibold text-sm">{policy.carrier}</span>
              <Badge variant="secondary" className="text-[11px]" data-testid={`badge-coverage-${policy.id}`}>
                {policy.coverageType}
              </Badge>
              {policyStatus === "expiring_soon" && (
                <Badge
                  className="text-[11px] gap-1 border-0"
                  style={{ backgroundColor: "#FEF3C7", color: "#D97706" }}
                  data-testid={`badge-expiring-${policy.id}`}
                >
                  <AlertTriangle className="w-3 h-3" />
                  Expiring Soon
                </Badge>
              )}
              {policyStatus === "expired" && (
                <Badge
                  className="text-[11px] border-0"
                  style={{ backgroundColor: "#FEE2E2", color: "#DC2626" }}
                  data-testid={`badge-expired-${policy.id}`}
                >
                  Expired
                </Badge>
              )}
            </div>

            {/* Details row */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Hash className="w-3 h-3" />
                {policy.policyNumber}
              </span>
              {policy.premium != null && (
                <span
                  className="flex items-center gap-1 font-medium"
                  style={{ color: "#059669" }}
                  data-testid={`text-premium-${policy.id}`}
                >
                  <DollarSign className="w-3 h-3" />
                  {formatCurrency(policy.premium)}/yr
                </span>
              )}
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {formatDate(policy.effectiveDate)}
                <span className="text-muted-foreground/50 mx-0.5">→</span>
                <span
                  style={
                    policyStatus === "expired"
                      ? { color: "#DC2626" }
                      : policyStatus === "expiring_soon"
                      ? { color: "#D97706" }
                      : undefined
                  }
                  data-testid={`text-expiration-${policy.id}`}
                >
                  {formatDate(policy.expirationDate)}
                </span>
                {policyStatus === "expiring_soon" && (
                  <span className="text-amber-600 font-medium">
                    ({daysUntil}d left)
                  </span>
                )}
                {policyStatus === "expired" && (
                  <span className="text-red-600 font-medium">
                    ({Math.abs(daysUntil)}d ago)
                  </span>
                )}
              </span>
            </div>

            {policy.notes && (
              <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">
                {policy.notes}
              </p>
            )}
          </div>

          {canManage && (
            <div className="flex items-center gap-1 flex-shrink-0">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => onEdit(policy)}
                data-testid={`button-edit-policy-${policy.id}`}
              >
                <Pencil className="w-3.5 h-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                onClick={() => onDelete(policy.id)}
                data-testid={`button-delete-policy-${policy.id}`}
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

function PolicyDialog({
  policy,
  associationId,
  onClose,
}: {
  policy: InsurancePolicy | null;
  associationId: string;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const isEdit = !!policy;
  const today = new Date().toISOString().slice(0, 10);

  const [carrier, setCarrier] = useState(policy?.carrier ?? "");
  const [policyNumber, setPolicyNumber] = useState(policy?.policyNumber ?? "");
  const [coverageType, setCoverageType] = useState(policy?.coverageType ?? COVERAGE_TYPES[0]);
  const [premium, setPremium] = useState(
    policy?.premium != null ? String(policy.premium) : ""
  );
  const [effectiveDate, setEffectiveDate] = useState(policy?.effectiveDate ?? today);
  const [expirationDate, setExpirationDate] = useState(policy?.expirationDate ?? "");
  const [notes, setNotes] = useState(policy?.notes ?? "");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!carrier.trim()) {
      toast({ title: "Carrier is required", variant: "destructive" });
      return;
    }
    if (!policyNumber.trim()) {
      toast({ title: "Policy number is required", variant: "destructive" });
      return;
    }
    if (!effectiveDate || !expirationDate) {
      toast({ title: "Effective and expiration dates are required", variant: "destructive" });
      return;
    }

    const payload: Record<string, unknown> = {
      carrier,
      policyNumber,
      coverageType,
      effectiveDate,
      expirationDate,
      notes: notes || undefined,
    };
    if (premium.trim()) {
      const parsed = parseFloat(premium);
      if (!isNaN(parsed)) payload.premium = parsed;
    }

    setSaving(true);
    try {
      if (isEdit) {
        await apiRequest("PATCH", `/api/insurance/item/${policy.id}`, payload);
      } else {
        await apiRequest("POST", `/api/insurance/${associationId}`, {
          ...payload,
          associationId,
        });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/insurance", associationId] });
      toast({ title: isEdit ? "Policy updated" : "Policy created" });
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
          <DialogTitle data-testid="text-policy-dialog-title">
            {isEdit ? "Edit Policy" : "New Insurance Policy"}
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4 mt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>Carrier</Label>
              <Input
                value={carrier}
                onChange={(e) => setCarrier(e.target.value)}
                placeholder="State Farm, Travelers..."
                data-testid="input-policy-carrier"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Policy Number</Label>
              <Input
                value={policyNumber}
                onChange={(e) => setPolicyNumber(e.target.value)}
                placeholder="POL-000000"
                data-testid="input-policy-number"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>Coverage Type</Label>
              <Select value={coverageType} onValueChange={setCoverageType}>
                <SelectTrigger data-testid="select-coverage-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COVERAGE_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Annual Premium ($)</Label>
              <Input
                type="number"
                min={0}
                value={premium}
                onChange={(e) => setPremium(e.target.value)}
                placeholder="0"
                data-testid="input-policy-premium"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>Effective Date</Label>
              <Input
                type="date"
                value={effectiveDate}
                onChange={(e) => setEffectiveDate(e.target.value)}
                data-testid="input-effective-date"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Expiration Date</Label>
              <Input
                type="date"
                value={expirationDate}
                onChange={(e) => setExpirationDate(e.target.value)}
                data-testid="input-expiration-date"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Notes</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional notes (optional)"
              rows={2}
              data-testid="input-policy-notes"
            />
          </div>

          <div className="flex justify-end gap-2 mt-2">
            <Button variant="outline" onClick={onClose} data-testid="button-cancel-policy">
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving} data-testid="button-save-policy">
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : null}
              {isEdit ? "Save Changes" : "Create Policy"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
