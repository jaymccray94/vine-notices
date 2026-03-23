import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import {
  Plus, Search, Pencil, Trash2, Loader2, Store,
  Phone, Mail, ExternalLink,
} from "lucide-react";

interface Vendor {
  id: string;
  associationId: string;
  name: string;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  category: string;
  status: "active" | "inactive";
  insuranceExpiry: string | null;
  notes: string | null;
  cincVendorId: string | null;
  createdBy: string;
  createdAt: string;
}

const VENDOR_CATEGORIES = [
  "Landscaping",
  "Pool Maintenance",
  "Security",
  "Pest Control",
  "Plumbing",
  "Electrical",
  "HVAC",
  "Painting",
  "Roofing",
  "General Maintenance",
  "Legal",
  "Accounting",
  "Insurance",
  "Management",
  "Other",
];

const emptyForm = {
  name: "",
  contactName: "",
  phone: "",
  email: "",
  category: "General Maintenance",
  status: "active" as const,
  insuranceExpiry: "",
  notes: "",
};

export default function AdminVendorsPage({ associationId }: { associationId: string }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const { data: vendors = [], isLoading } = useQuery<Vendor[]>({
    queryKey: ["/api/vendors", associationId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/vendors/${associationId}`);
      return res.json();
    },
  });

  const canManage = user?.role === "super_admin" || user?.role === "association_admin";

  const createMutation = useMutation({
    mutationFn: async (data: typeof emptyForm) => {
      const res = await apiRequest("POST", `/api/vendors/${associationId}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vendors", associationId] });
      toast({ title: "Vendor added" });
      closeDialog();
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<typeof emptyForm> }) => {
      const res = await apiRequest("PUT", `/api/vendors/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vendors", associationId] });
      toast({ title: "Vendor updated" });
      closeDialog();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/vendors/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vendors", associationId] });
      toast({ title: "Vendor removed" });
      setDeleteConfirm(null);
    },
  });

  function closeDialog() {
    setDialogOpen(false);
    setEditingVendor(null);
    setForm(emptyForm);
  }

  function openCreate() {
    setEditingVendor(null);
    setForm(emptyForm);
    setDialogOpen(true);
  }

  function openEdit(v: Vendor) {
    setEditingVendor(v);
    setForm({
      name: v.name,
      contactName: v.contactName || "",
      phone: v.phone || "",
      email: v.email || "",
      category: v.category,
      status: v.status,
      insuranceExpiry: v.insuranceExpiry || "",
      notes: v.notes || "",
    });
    setDialogOpen(true);
  }

  function handleSubmit() {
    if (!form.name.trim()) return;
    if (editingVendor) {
      updateMutation.mutate({ id: editingVendor.id, data: form });
    } else {
      createMutation.mutate(form);
    }
  }

  const filtered = vendors
    .filter((v) => {
      if (categoryFilter !== "all" && v.category !== categoryFilter) return false;
      if (search) {
        const s = search.toLowerCase();
        return (
          v.name.toLowerCase().includes(s) ||
          (v.contactName && v.contactName.toLowerCase().includes(s)) ||
          (v.email && v.email.toLowerCase().includes(s))
        );
      }
      return true;
    });

  const activeCount = vendors.filter((v) => v.status === "active").length;
  const categories = [...new Set(vendors.map((v) => v.category))].sort();

  // Check insurance expiring within 30 days
  const today = new Date();
  const in30 = new Date();
  in30.setDate(in30.getDate() + 30);
  const expiringInsurance = vendors.filter((v) => {
    if (!v.insuranceExpiry) return false;
    const d = new Date(v.insuranceExpiry);
    return d >= today && d <= in30;
  }).length;

  if (isLoading) {
    return (
      <div className="p-6 max-w-6xl mx-auto space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-3 gap-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20" />)}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-lg font-bold" data-testid="text-vendors-title">Vendors</h1>
          <p className="text-sm text-muted-foreground">Manage vendors and service providers</p>
        </div>
        {canManage && (
          <Button onClick={openCreate} size="sm" data-testid="button-add-vendor">
            <Plus className="w-4 h-4 mr-1" />
            Add Vendor
          </Button>
        )}
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <Card>
          <CardContent className="p-3">
            <p className="text-lg font-bold" data-testid="stat-total-vendors">{vendors.length}</p>
            <p className="text-[11px] text-muted-foreground">Total Vendors</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-lg font-bold text-green-600">{activeCount}</p>
            <p className="text-[11px] text-muted-foreground">Active</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-lg font-bold">{categories.length}</p>
            <p className="text-[11px] text-muted-foreground">Categories</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className={`text-lg font-bold ${expiringInsurance > 0 ? "text-amber-600" : ""}`}>{expiringInsurance}</p>
            <p className="text-[11px] text-muted-foreground">Insurance Expiring</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-4">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search vendors..."
            className="pl-8 h-9"
            data-testid="input-vendor-search"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[180px] h-9" data-testid="select-vendor-category-filter">
            <SelectValue placeholder="All categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {VENDOR_CATEGORIES.map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vendor</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Insurance Exp.</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">CINC</TableHead>
                {canManage && <TableHead className="w-20" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={canManage ? 7 : 6} className="text-center py-8 text-muted-foreground">
                    <Store className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">No vendors found</p>
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((v) => {
                  const isExpiringSoon = v.insuranceExpiry && (() => {
                    const d = new Date(v.insuranceExpiry!);
                    return d >= today && d <= in30;
                  })();
                  const isExpired = v.insuranceExpiry && new Date(v.insuranceExpiry) < today;

                  return (
                    <TableRow key={v.id} data-testid={`row-vendor-${v.id}`}>
                      <TableCell>
                        <div>
                          <p className="font-medium text-sm">{v.name}</p>
                          {v.contactName && (
                            <p className="text-xs text-muted-foreground">{v.contactName}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[11px]">{v.category}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-0.5">
                          {v.phone && (
                            <span className="text-xs flex items-center gap-1">
                              <Phone className="w-3 h-3" />{v.phone}
                            </span>
                          )}
                          {v.email && (
                            <span className="text-xs flex items-center gap-1">
                              <Mail className="w-3 h-3" />{v.email}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {v.insuranceExpiry ? (
                          <span className={`text-xs font-medium ${isExpired ? "text-red-600" : isExpiringSoon ? "text-amber-600" : ""}`}>
                            {new Date(v.insuranceExpiry).toLocaleDateString()}
                            {isExpired && " (Expired)"}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={v.status === "active" ? "default" : "secondary"}
                          className={`text-[10px] ${v.status === "active" ? "bg-green-600 hover:bg-green-600" : ""}`}
                        >
                          {v.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {v.cincVendorId ? (
                          <Badge variant="outline" className="text-[10px] gap-1">
                            <ExternalLink className="w-3 h-3" />
                            Linked
                          </Badge>
                        ) : (
                          <span className="text-[11px] text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      {canManage && (
                        <TableCell>
                          <div className="flex gap-1 justify-end">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => openEdit(v)}
                              data-testid={`button-edit-vendor-${v.id}`}
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive hover:text-destructive"
                              onClick={() => setDeleteConfirm(v.id)}
                              data-testid={`button-delete-vendor-${v.id}`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(o) => !o && closeDialog()}>
        <DialogContent className="max-w-lg" data-testid="dialog-vendor-form">
          <DialogHeader>
            <DialogTitle>{editingVendor ? "Edit Vendor" : "Add Vendor"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs mb-1 block">Company Name</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="ABC Landscaping"
                  data-testid="input-vendor-name"
                />
              </div>
              <div>
                <Label className="text-xs mb-1 block">Contact Name</Label>
                <Input
                  value={form.contactName}
                  onChange={(e) => setForm({ ...form, contactName: e.target.value })}
                  placeholder="John Smith"
                  data-testid="input-vendor-contact"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs mb-1 block">Phone</Label>
                <Input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="(555) 123-4567"
                  data-testid="input-vendor-phone"
                />
              </div>
              <div>
                <Label className="text-xs mb-1 block">Email</Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="vendor@example.com"
                  data-testid="input-vendor-email"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs mb-1 block">Category</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                  <SelectTrigger data-testid="select-vendor-category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {VENDOR_CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs mb-1 block">Status</Label>
                <Select value={form.status} onValueChange={(v: "active" | "inactive") => setForm({ ...form, status: v })}>
                  <SelectTrigger data-testid="select-vendor-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="text-xs mb-1 block">Insurance Expiration</Label>
              <Input
                type="date"
                value={form.insuranceExpiry}
                onChange={(e) => setForm({ ...form, insuranceExpiry: e.target.value })}
                data-testid="input-vendor-insurance-exp"
              />
            </div>
            <div>
              <Label className="text-xs mb-1 block">Notes</Label>
              <Input
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Optional notes..."
                data-testid="input-vendor-notes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancel</Button>
            <Button
              onClick={handleSubmit}
              disabled={createMutation.isPending || updateMutation.isPending || !form.name.trim()}
              data-testid="button-save-vendor"
            >
              {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
              {editingVendor ? "Update" : "Add"} Vendor
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent className="max-w-sm" data-testid="dialog-delete-vendor">
          <DialogHeader>
            <DialogTitle>Remove Vendor?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">This action cannot be undone.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirm && deleteMutation.mutate(deleteConfirm)}
              disabled={deleteMutation.isPending}
              data-testid="button-confirm-delete-vendor"
            >
              {deleteMutation.isPending && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
