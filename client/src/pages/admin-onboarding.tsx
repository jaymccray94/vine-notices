import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import type { OnboardingChecklist } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, ChevronDown, ChevronRight, CheckSquare, Square, Loader2, ClipboardList, X, Wand2 } from "lucide-react";

const TEMPLATE_ITEMS = [
  "Collect governing documents",
  "Set up bank accounts",
  "Configure insurance policies",
  "Create community website",
  "Send welcome packet to board",
  "Schedule first board meeting",
  "Set up accounting system",
  "Configure notice portal",
  "Establish vendor contacts",
  "Board member training",
];

function progressColor(pct: number) {
  if (pct > 75) return "bg-green-500";
  if (pct >= 25) return "bg-amber-500";
  return "bg-red-500";
}

export default function AdminOnboardingPage({ associationId }: { associationId: string }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [creating, setCreating] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [togglingItem, setTogglingItem] = useState<string | null>(null);

  const canManage = user?.role === "super_admin" || user?.associations?.some(
    (a) => a.associationId === associationId && a.permission === "manage"
  );

  const { data: checklists = [], isLoading } = useQuery<OnboardingChecklist[]>({
    queryKey: ["/api/onboarding", associationId],
    enabled: !!associationId,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/onboarding/item/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/onboarding", associationId] });
      toast({ title: "Checklist deleted" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  async function toggleItem(checklistId: string, itemId: string) {
    setTogglingItem(itemId);
    try {
      await apiRequest("PATCH", `/api/onboarding/item/${checklistId}/toggle/${itemId}`);
      queryClient.invalidateQueries({ queryKey: ["/api/onboarding", associationId] });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setTogglingItem(null);
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
          <h2 className="text-lg font-bold" data-testid="text-onboarding-heading">Onboarding Checklists</h2>
          <p className="text-sm text-muted-foreground">
            {checklists.length} checklist{checklists.length !== 1 ? "s" : ""}
          </p>
        </div>
        {canManage && (
          <Button onClick={() => setCreating(true)} size="sm" data-testid="button-create-checklist">
            <Plus className="w-4 h-4 mr-1.5" />
            New Checklist
          </Button>
        )}
      </div>

      {checklists.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground" data-testid="empty-checklists">
          <ClipboardList className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm font-medium">No checklists yet</p>
          <p className="text-xs mt-1">Create your first onboarding checklist to get started.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {checklists.map((checklist) => {
            const total = checklist.items.length;
            const completed = checklist.items.filter((i) => i.completed).length;
            const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
            const isOpen = expanded.has(checklist.id);

            return (
              <Card key={checklist.id} className="hover:shadow-sm transition-shadow" data-testid={`card-checklist-${checklist.id}`}>
                <CardContent className="p-4">
                  {/* Header row */}
                  <div className="flex items-start gap-3">
                    <button
                      onClick={() => toggleExpanded(checklist.id)}
                      className="mt-0.5 text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
                      data-testid={`button-expand-${checklist.id}`}
                    >
                      {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span
                          className="font-semibold text-sm cursor-pointer"
                          onClick={() => toggleExpanded(checklist.id)}
                          data-testid={`text-checklist-title-${checklist.id}`}
                        >
                          {checklist.title}
                        </span>
                        <Badge variant="secondary" className="text-[11px]" data-testid={`badge-progress-${checklist.id}`}>
                          {completed} of {total} completed
                        </Badge>
                      </div>
                      {/* Progress bar */}
                      <div className="flex items-center gap-2 mb-1">
                        <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden" data-testid={`progress-bar-${checklist.id}`}>
                          <div
                            className={`h-full rounded-full transition-all ${progressColor(pct)}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground w-8 text-right">{pct}%</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Created {new Date(checklist.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </p>
                    </div>
                    {canManage && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-destructive hover:text-destructive flex-shrink-0"
                        onClick={() => {
                          if (confirm("Delete this checklist?")) deleteMutation.mutate(checklist.id);
                        }}
                        data-testid={`button-delete-checklist-${checklist.id}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>

                  {/* Expanded items */}
                  {isOpen && (
                    <div className="mt-3 ml-7 flex flex-col gap-1.5" data-testid={`items-list-${checklist.id}`}>
                      {checklist.items.length === 0 ? (
                        <p className="text-xs text-muted-foreground italic">No items in this checklist.</p>
                      ) : (
                        checklist.items.map((item) => (
                          <div
                            key={item.id}
                            className="flex items-center gap-2 group"
                            data-testid={`item-row-${item.id}`}
                          >
                            <button
                              onClick={() => canManage && toggleItem(checklist.id, item.id)}
                              disabled={!canManage || togglingItem === item.id}
                              className="flex-shrink-0 text-muted-foreground hover:text-foreground disabled:opacity-50 transition-colors"
                              data-testid={`button-toggle-item-${item.id}`}
                            >
                              {togglingItem === item.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : item.completed ? (
                                <CheckSquare className="w-4 h-4 text-green-500" />
                              ) : (
                                <Square className="w-4 h-4" />
                              )}
                            </button>
                            <span
                              className={`text-sm transition-colors ${
                                item.completed
                                  ? "line-through text-muted-foreground"
                                  : "text-foreground"
                              }`}
                              data-testid={`text-item-label-${item.id}`}
                            >
                              {item.label}
                            </span>
                            {item.completed && item.completedAt && (
                              <span className="text-xs text-muted-foreground ml-auto opacity-0 group-hover:opacity-100 transition-opacity">
                                {new Date(item.completedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                              </span>
                            )}
                          </div>
                        ))
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
        <ChecklistDialog
          associationId={associationId}
          onClose={() => setCreating(false)}
        />
      )}
    </div>
  );
}

function ChecklistDialog({
  associationId,
  onClose,
}: {
  associationId: string;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [items, setItems] = useState<string[]>([""]);
  const [saving, setSaving] = useState(false);

  function addItem() {
    setItems((prev) => [...prev, ""]);
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  function updateItem(index: number, value: string) {
    setItems((prev) => prev.map((item, i) => (i === index ? value : item)));
  }

  function applyTemplate() {
    setTitle("New Community Setup");
    setItems([...TEMPLATE_ITEMS]);
  }

  async function handleSave() {
    if (!title.trim()) {
      toast({ title: "Title is required", variant: "destructive" });
      return;
    }
    const validItems = items.filter((i) => i.trim()).map((label) => ({ label: label.trim() }));
    setSaving(true);
    try {
      await apiRequest("POST", `/api/onboarding/${associationId}`, {
        title: title.trim(),
        items: validItems,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/onboarding", associationId] });
      toast({ title: "Checklist created" });
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
          <DialogTitle data-testid="text-checklist-dialog-title">New Onboarding Checklist</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4 mt-2">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <Label>Title</Label>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs gap-1.5"
                onClick={applyTemplate}
                data-testid="button-use-template"
              >
                <Wand2 className="w-3.5 h-3.5" />
                Use Template
              </Button>
            </div>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Checklist title"
              data-testid="input-checklist-title"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label>Items</Label>
            <div className="flex flex-col gap-1.5" data-testid="checklist-items-list">
              {items.map((item, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Input
                    value={item}
                    onChange={(e) => updateItem(index, e.target.value)}
                    placeholder={`Item ${index + 1}`}
                    className="h-8 text-sm"
                    data-testid={`input-item-${index}`}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive flex-shrink-0"
                    onClick={() => removeItem(index)}
                    data-testid={`button-remove-item-${index}`}
                  >
                    <X className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ))}
            </div>
            <Button
              variant="outline"
              size="sm"
              className="mt-1 self-start gap-1.5"
              onClick={addItem}
              data-testid="button-add-item"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Item
            </Button>
          </div>

          <div className="flex justify-end gap-2 mt-2">
            <Button variant="outline" onClick={onClose} data-testid="button-cancel-checklist">
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving} data-testid="button-save-checklist">
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : null}
              Create Checklist
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
