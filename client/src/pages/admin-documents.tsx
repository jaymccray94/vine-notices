import { EmptyState } from "@/components/empty-state";
import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  Plus, FileText, Trash2, Pencil, Loader2, Search,
  FolderOpen, Eye, EyeOff, Upload, Calendar, Scale,
  ChevronRight, Archive,
} from "lucide-react";

interface DocumentCategory {
  id: string;
  label: string;
  description: string;
  retention: string;
  statute: string;
}

interface AssociationDocument {
  id: string;
  associationId: string;
  title: string;
  category: string;
  description: string | null;
  filename?: string;
  fileSize?: number;
  status: "current" | "archived" | "draft" | "expired";
  effectiveDate: string | null;
  expirationDate: string | null;
  retentionYears: number | null;
  isPublic: boolean;
  tags: string[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  current: { label: "Current", color: "#22C55E" },
  archived: { label: "Archived", color: "#6B7280" },
  draft: { label: "Draft", color: "#F59E0B" },
  expired: { label: "Expired", color: "#EF4444" },
};

export default function AdminDocumentsPage({ associationId }: { associationId: string }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [editing, setEditing] = useState<AssociationDocument | null>(null);
  const [creating, setCreating] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("current");

  const canManage =
    user?.role === "super_admin" ||
    user?.associations?.some(
      (a) => a.associationId === associationId && a.permission === "manage"
    );

  const { data: categories = [] } = useQuery<DocumentCategory[]>({
    queryKey: ["/api/document-categories"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/document-categories");
      return res.json();
    },
  });

  const { data: documents = [], isLoading } = useQuery<AssociationDocument[]>({
    queryKey: ["/api/documents", associationId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/documents/${associationId}`);
      return res.json();
    },
    enabled: !!associationId,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/documents/item/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents", associationId] });
      toast({ title: "Document deleted" });
    },
  });

  const filtered = useMemo(() => {
    let list = documents;
    if (statusFilter !== "all") {
      list = list.filter((d) => d.status === statusFilter);
    }
    if (selectedCategory !== "all") {
      list = list.filter((d) => d.category === selectedCategory);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (d) =>
          d.title.toLowerCase().includes(q) ||
          d.description?.toLowerCase().includes(q) ||
          d.tags.some((t) => t.toLowerCase().includes(q))
      );
    }
    return list;
  }, [documents, statusFilter, selectedCategory, searchQuery]);

  // Group by category for display
  const grouped = useMemo(() => {
    const map = new Map<string, AssociationDocument[]>();
    for (const doc of filtered) {
      const arr = map.get(doc.category) || [];
      arr.push(doc);
      map.set(doc.category, arr);
    }
    return map;
  }, [filtered]);

  const getCategoryLabel = (catId: string) => {
    const cat = categories.find((c) => c.id === catId);
    return cat?.label || catId;
  };

  const getCategoryInfo = (catId: string) => {
    return categories.find((c) => c.id === catId);
  };

  // Stats
  const totalDocs = documents.length;
  const currentDocs = documents.filter((d) => d.status === "current").length;
  const publicDocs = documents.filter((d) => d.isPublic).length;
  const categoriesWithDocs = new Set(documents.map((d) => d.category)).size;

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
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-lg font-bold" data-testid="text-documents-heading">
            Document Library
          </h2>
          <p className="text-sm text-muted-foreground">
            {totalDocs} documents · {currentDocs} current · {publicDocs} public · {categoriesWithDocs} categories
          </p>
        </div>
        {canManage && (
          <Button onClick={() => setCreating(true)} size="sm" data-testid="button-add-document">
            <Plus className="w-4 h-4 mr-1.5" />
            Add Document
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            placeholder="Search documents..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 h-9 text-sm"
            data-testid="input-search-documents"
          />
        </div>

        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
          <SelectTrigger className="w-[200px] h-9 text-sm" data-testid="select-category-filter">
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Tabs value={statusFilter} onValueChange={setStatusFilter}>
          <TabsList className="h-9">
            <TabsTrigger value="current" className="text-xs px-3" data-testid="filter-current">Current</TabsTrigger>
            <TabsTrigger value="all" className="text-xs px-3" data-testid="filter-all">All</TabsTrigger>
            <TabsTrigger value="archived" className="text-xs px-3" data-testid="filter-archived">Archived</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Document List grouped by category */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={FolderOpen}
          title={documents.length === 0 ? "No documents yet" : "No documents match your filters"}
          description={documents.length === 0 ? "Organize association documents by Florida HOA compliance categories." : "Try adjusting your search or filter criteria."}
          actionLabel="Add Document"
          onAction={() => setCreating(true)}
          showAction={documents.length === 0 && canManage}
        />
      ) : (
        <div className="space-y-5">
          {[...grouped.entries()].map(([catId, docs]) => {
            const catInfo = getCategoryInfo(catId);
            return (
              <div key={catId} data-testid={`category-section-${catId}`}>
                <div className="flex items-center gap-2 mb-2 px-1">
                  <FolderOpen className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-semibold">{getCategoryLabel(catId)}</span>
                  <span className="text-xs text-muted-foreground">({docs.length})</span>
                  {catInfo?.statute && (
                    <span className="text-[10px] text-muted-foreground/60 ml-auto">
                      <Scale className="w-3 h-3 inline mr-0.5" />
                      F.S. {catInfo.statute} · Retain {catInfo.retention}
                    </span>
                  )}
                </div>
                <div className="border rounded-lg overflow-hidden">
                  {docs.map((doc, idx) => {
                    const statusConf = STATUS_CONFIG[doc.status] || STATUS_CONFIG.current;
                    return (
                      <div
                        key={doc.id}
                        className={`flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors ${idx > 0 ? "border-t" : ""}`}
                        data-testid={`doc-row-${doc.id}`}
                      >
                        <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium truncate">{doc.title}</span>
                            <span
                              className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wide"
                              style={{ backgroundColor: `${statusConf.color}18`, color: statusConf.color }}
                            >
                              {statusConf.label}
                            </span>
                            {doc.isPublic ? (
                              <Eye className="w-3 h-3 text-green-600" />
                            ) : (
                              <EyeOff className="w-3 h-3 text-muted-foreground/40" />
                            )}
                          </div>
                          {doc.description && (
                            <p className="text-xs text-muted-foreground truncate mt-0.5">{doc.description}</p>
                          )}
                          <div className="flex items-center gap-3 mt-1">
                            {doc.effectiveDate && (
                              <span className="text-[10px] text-muted-foreground">
                                <Calendar className="w-2.5 h-2.5 inline mr-0.5" />
                                {new Date(doc.effectiveDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                              </span>
                            )}
                            {doc.filename && (
                              <span className="text-[10px] text-green-600 font-medium">
                                <Upload className="w-2.5 h-2.5 inline mr-0.5" />
                                File attached
                              </span>
                            )}
                            {doc.tags.length > 0 && (
                              <div className="flex gap-1">
                                {doc.tags.slice(0, 3).map((tag) => (
                                  <span key={tag} className="text-[9px] bg-muted px-1.5 py-0.5 rounded">{tag}</span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                        {canManage && (
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0"
                              onClick={() => setEditing(doc)}
                              data-testid={`button-edit-doc-${doc.id}`}
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                              onClick={() => {
                                if (confirm("Delete this document?")) deleteMutation.mutate(doc.id);
                              }}
                              data-testid={`button-delete-doc-${doc.id}`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Compliance summary card */}
      {categories.length > 0 && (
        <div className="mt-6 border rounded-lg p-4" data-testid="compliance-summary">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Scale className="w-4 h-4" />
            Florida Compliance Checklist
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {categories.map((cat) => {
              const count = documents.filter((d) => d.category === cat.id && d.status === "current").length;
              const hasDoc = count > 0;
              return (
                <div
                  key={cat.id}
                  className={`flex items-center gap-2 px-3 py-2 rounded text-xs ${hasDoc ? "bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-400" : "bg-muted/50 text-muted-foreground"}`}
                  data-testid={`compliance-${cat.id}`}
                >
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${hasDoc ? "bg-green-500" : "bg-muted-foreground/30"}`} />
                  <span className="truncate flex-1">{cat.label}</span>
                  <span className="font-semibold">{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {(creating || editing) && (
        <DocumentDialog
          document={editing}
          associationId={associationId}
          categories={categories}
          onClose={() => { setCreating(false); setEditing(null); }}
        />
      )}
    </div>
  );
}

function DocumentDialog({
  document: doc,
  associationId,
  categories,
  onClose,
}: {
  document: AssociationDocument | null;
  associationId: string;
  categories: DocumentCategory[];
  onClose: () => void;
}) {
  const { toast } = useToast();
  const isEdit = !!doc;
  const [title, setTitle] = useState(doc?.title ?? "");
  const [category, setCategory] = useState(doc?.category ?? "governing");
  const [description, setDescription] = useState(doc?.description ?? "");
  const [status, setStatus] = useState<string>(doc?.status ?? "current");
  const [effectiveDate, setEffectiveDate] = useState(doc?.effectiveDate ?? "");
  const [expirationDate, setExpirationDate] = useState(doc?.expirationDate ?? "");
  const [isPublic, setIsPublic] = useState(doc?.isPublic ?? false);
  const [tagsStr, setTagsStr] = useState((doc?.tags || []).join(", "));
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!title.trim()) {
      toast({ title: "Title is required", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const tags = tagsStr
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      const body = {
        title,
        category,
        description: description || null,
        status,
        effectiveDate: effectiveDate || null,
        expirationDate: expirationDate || null,
        isPublic,
        tags,
      };
      if (isEdit) {
        await apiRequest("PATCH", `/api/documents/item/${doc.id}`, body);
      } else {
        await apiRequest("POST", `/api/documents/${associationId}`, body);
      }
      queryClient.invalidateQueries({ queryKey: ["/api/documents", associationId] });
      toast({ title: isEdit ? "Document updated" : "Document added" });
      onClose();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle data-testid="text-doc-dialog-title">
            {isEdit ? "Edit Document" : "Add Document"}
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4 mt-2">
          <div className="flex flex-col gap-1.5">
            <Label>Title</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Document title"
              data-testid="input-doc-title"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger data-testid="select-doc-category">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {categories.find((c) => c.id === category) && (
              <p className="text-[10px] text-muted-foreground">
                <Scale className="w-2.5 h-2.5 inline mr-0.5" />
                F.S. {categories.find((c) => c.id === category)?.statute} · Retain {categories.find((c) => c.id === category)?.retention}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Description</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description..."
              rows={2}
              data-testid="input-doc-description"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>Effective Date</Label>
              <Input
                type="date"
                value={effectiveDate}
                onChange={(e) => setEffectiveDate(e.target.value)}
                data-testid="input-doc-effective-date"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Expiration Date</Label>
              <Input
                type="date"
                value={expirationDate}
                onChange={(e) => setExpirationDate(e.target.value)}
                data-testid="input-doc-expiration-date"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger data-testid="select-doc-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="current">Current</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Tags (comma separated)</Label>
              <Input
                value={tagsStr}
                onChange={(e) => setTagsStr(e.target.value)}
                placeholder="budget, 2025"
                data-testid="input-doc-tags"
              />
            </div>
          </div>

          <div className="flex items-center justify-between py-2 px-3 bg-muted/50 rounded-lg">
            <div>
              <Label className="text-sm font-medium">Public Document</Label>
              <p className="text-[11px] text-muted-foreground">Visible on the community website via API</p>
            </div>
            <Switch
              checked={isPublic}
              onCheckedChange={setIsPublic}
              data-testid="switch-doc-public"
            />
          </div>

          <div className="flex justify-end gap-2 mt-2">
            <Button variant="outline" onClick={onClose} data-testid="button-cancel-doc">
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving} data-testid="button-save-doc">
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : null}
              {isEdit ? "Save Changes" : "Add Document"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
