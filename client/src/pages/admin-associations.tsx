import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Association } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Building2, Link, Loader2, Copy, Check, Code, Eye } from "lucide-react";
import { useLocation } from "wouter";

export default function AdminAssociationsPage() {
  const { toast } = useToast();
  const [editing, setEditing] = useState<Association | null>(null);
  const [creating, setCreating] = useState(false);

  const { data: associations = [], isLoading } = useQuery<Association[]>({
    queryKey: ["/api/associations"],
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/associations/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/associations"] });
      toast({ title: "Association deleted" });
    },
  });

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3 p-6">
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 rounded-lg" />)}
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-bold" data-testid="text-associations-heading">Associations</h2>
          <p className="text-sm text-muted-foreground">Manage HOA communities</p>
        </div>
        <Button onClick={() => setCreating(true)} size="sm" data-testid="button-create-association">
          <Plus className="w-4 h-4 mr-1.5" />
          New Association
        </Button>
      </div>

      {associations.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground" data-testid="empty-associations">
          <Building2 className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm font-medium">No associations yet</p>
          <p className="text-xs mt-1">Create your first association to get started.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {associations.map((assoc) => (
            <AssociationCard
              key={assoc.id}
              association={assoc}
              onEdit={() => setEditing(assoc)}
              onDelete={() => {
                if (confirm(`Delete "${assoc.name}" and all its notices?`)) {
                  deleteMutation.mutate(assoc.id);
                }
              }}
            />
          ))}
        </div>
      )}

      {(creating || editing) && (
        <AssociationDialog
          association={editing}
          onClose={() => { setCreating(false); setEditing(null); }}
        />
      )}
    </div>
  );
}

function AssociationCard({
  association,
  onEdit,
  onDelete,
}: {
  association: Association;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [, setLocation] = useLocation();
  const [showEmbed, setShowEmbed] = useState(false);
  const [copiedPath, setCopiedPath] = useState(false);
  const [copiedHtml, setCopiedHtml] = useState(false);
  const [copiedMeetingsPath, setCopiedMeetingsPath] = useState(false);
  const [copiedMeetingsHtml, setCopiedMeetingsHtml] = useState(false);

  // Build the full base URL from the current page origin
  // In production the deployed URL is used; locally it uses localhost
  const baseUrl = typeof window !== "undefined" ? window.location.origin + window.location.pathname.replace(/\/[^/]*$/, "") : "";
  const embedUrl = `${baseUrl}/#/embed/${association.slug}`;
  const meetingsEmbedUrl = `${baseUrl}/#/embed/${association.slug}/meetings`;
  const iframeSnippet = `<iframe\n  src="${embedUrl}"\n  width="100%"\n  height="800"\n  style="border: none; border-radius: 8px;"\n  title="${association.name} — Notices"\n></iframe>`;
  const meetingsIframeSnippet = `<iframe\n  src="${meetingsEmbedUrl}"\n  width="100%"\n  height="800"\n  style="border: none; border-radius: 8px;"\n  title="${association.name} — Meetings"\n></iframe>`;

  function copyText(text: string, setter: (v: boolean) => void) {
    navigator.clipboard.writeText(text).catch(() => {});
    setter(true);
    setTimeout(() => setter(false), 2000);
  }

  return (
    <Card className="hover:shadow-sm transition-shadow" data-testid={`card-association-${association.id}`}>
      <CardContent className="p-4">
        <div className="flex items-center gap-4">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: association.primaryColor + "18" }}
          >
            <Building2 className="w-5 h-5" style={{ color: association.primaryColor }} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="font-semibold text-sm">{association.name}</span>
              <Badge variant="outline" className="text-[11px] gap-1">
                <Link className="w-3 h-3" />
                /{association.slug}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex gap-1">
                {[association.primaryColor, association.accentColor, association.darkColor].map((c, i) => (
                  <div key={i} className="w-4 h-4 rounded-sm border border-border" style={{ backgroundColor: c }} />
                ))}
              </div>
              <button
                onClick={() => setLocation(`/preview/${association.slug}`)}
                className="text-[11px] text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
                data-testid={`button-preview-${association.id}`}
              >
                <Eye className="w-3 h-3" />
                Preview
              </button>
              <span className="text-muted-foreground/30">·</span>
              <button
                onClick={() => setShowEmbed(!showEmbed)}
                className="text-[11px] text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
                data-testid={`button-embed-toggle-${association.id}`}
              >
                <Code className="w-3 h-3" />
                {showEmbed ? "Hide embed code" : "Embed code"}
              </button>
            </div>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={onEdit} data-testid={`button-edit-${association.id}`}>
              <Pencil className="w-3.5 h-3.5" />
            </Button>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-destructive hover:text-destructive" onClick={onDelete} data-testid={`button-delete-${association.id}`}>
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>

        {/* Embed code panel */}
        {showEmbed && (
          <div className="mt-4 pt-4 border-t border-border" data-testid={`embed-panel-${association.id}`}>
            <p className="text-xs font-medium text-foreground mb-2">Embed this association's notices in your portal</p>

            {/* Direct URL */}
            <div className="mb-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] text-muted-foreground font-medium">Direct URL</span>
                <button
                  onClick={() => copyText(embedUrl, setCopiedPath)}
                  className="text-[11px] text-primary hover:text-primary/80 transition-colors flex items-center gap-1"
                  data-testid={`button-copy-url-${association.id}`}
                >
                  {copiedPath ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  {copiedPath ? "Copied" : "Copy"}
                </button>
              </div>
              <div className="bg-muted rounded-md px-3 py-2 text-xs font-mono text-muted-foreground break-all select-all" data-testid={`text-embed-url-${association.id}`}>
                {embedUrl}
              </div>
            </div>

            {/* iframe HTML */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] text-muted-foreground font-medium">HTML Embed Code</span>
                <button
                  onClick={() => copyText(iframeSnippet, setCopiedHtml)}
                  className="text-[11px] text-primary hover:text-primary/80 transition-colors flex items-center gap-1"
                  data-testid={`button-copy-html-${association.id}`}
                >
                  {copiedHtml ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  {copiedHtml ? "Copied" : "Copy HTML"}
                </button>
              </div>
              <pre className="bg-muted rounded-md px-3 py-2.5 text-[11px] font-mono text-muted-foreground whitespace-pre-wrap break-all select-all leading-relaxed" data-testid={`text-embed-html-${association.id}`}>{iframeSnippet}</pre>
            </div>

            {/* Meetings embed */}
            <div className="mt-4 pt-4 border-t border-border/60">
              <p className="text-xs font-medium text-foreground mb-2">Meetings embed</p>

              <div className="mb-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] text-muted-foreground font-medium">Meetings URL</span>
                  <button
                    onClick={() => copyText(meetingsEmbedUrl, setCopiedMeetingsPath)}
                    className="text-[11px] text-primary hover:text-primary/80 transition-colors flex items-center gap-1"
                    data-testid={`button-copy-meetings-url-${association.id}`}
                  >
                    {copiedMeetingsPath ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    {copiedMeetingsPath ? "Copied" : "Copy"}
                  </button>
                </div>
                <div className="bg-muted rounded-md px-3 py-2 text-xs font-mono text-muted-foreground break-all select-all">
                  {meetingsEmbedUrl}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] text-muted-foreground font-medium">Meetings HTML</span>
                  <button
                    onClick={() => copyText(meetingsIframeSnippet, setCopiedMeetingsHtml)}
                    className="text-[11px] text-primary hover:text-primary/80 transition-colors flex items-center gap-1"
                    data-testid={`button-copy-meetings-html-${association.id}`}
                  >
                    {copiedMeetingsHtml ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    {copiedMeetingsHtml ? "Copied" : "Copy HTML"}
                  </button>
                </div>
                <pre className="bg-muted rounded-md px-3 py-2.5 text-[11px] font-mono text-muted-foreground whitespace-pre-wrap break-all select-all leading-relaxed">{meetingsIframeSnippet}</pre>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function AssociationDialog({
  association,
  onClose,
}: {
  association: Association | null;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const isEdit = !!association;
  const [name, setName] = useState(association?.name || "");
  const [slug, setSlug] = useState(association?.slug || "");
  const [primaryColor, setPrimaryColor] = useState(association?.primaryColor || "#317C3C");
  const [accentColor, setAccentColor] = useState(association?.accentColor || "#8BC53F");
  const [darkColor, setDarkColor] = useState(association?.darkColor || "#1B3E1E");
  const [saving, setSaving] = useState(false);

  function autoSlug(value: string) {
    setName(value);
    if (!isEdit) {
      setSlug(
        value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")
      );
    }
  }

  async function handleSave() {
    if (!name.trim() || !slug.trim()) {
      toast({ title: "Name and slug are required", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      if (isEdit) {
        await apiRequest("PATCH", `/api/associations/${association.id}`, { name, slug, primaryColor, accentColor, darkColor });
      } else {
        await apiRequest("POST", "/api/associations", { name, slug, primaryColor, accentColor, darkColor });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/associations"] });
      toast({ title: isEdit ? "Association updated" : "Association created" });
      onClose();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle data-testid="text-assoc-dialog-title">{isEdit ? "Edit Association" : "New Association"}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4 mt-2">
          <div className="flex flex-col gap-1.5">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => autoSlug(e.target.value)} placeholder="Rainbow Springs POA" data-testid="input-assoc-name" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>URL Slug</Label>
            <div className="flex items-center gap-0">
              <span className="text-sm text-muted-foreground px-3 py-2 border border-r-0 rounded-l-md bg-muted">/embed/</span>
              <Input value={slug} onChange={(e) => setSlug(e.target.value)} className="rounded-l-none" placeholder="rainbow-springs" data-testid="input-assoc-slug" />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Brand Colors</Label>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <span className="text-xs text-muted-foreground">Primary</span>
                <div className="flex items-center gap-2 mt-1">
                  <input type="color" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} className="w-8 h-8 rounded cursor-pointer border-0" />
                  <Input value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} className="h-8 text-xs font-mono" data-testid="input-primary-color" />
                </div>
              </div>
              <div>
                <span className="text-xs text-muted-foreground">Accent</span>
                <div className="flex items-center gap-2 mt-1">
                  <input type="color" value={accentColor} onChange={(e) => setAccentColor(e.target.value)} className="w-8 h-8 rounded cursor-pointer border-0" />
                  <Input value={accentColor} onChange={(e) => setAccentColor(e.target.value)} className="h-8 text-xs font-mono" data-testid="input-accent-color" />
                </div>
              </div>
              <div>
                <span className="text-xs text-muted-foreground">Dark</span>
                <div className="flex items-center gap-2 mt-1">
                  <input type="color" value={darkColor} onChange={(e) => setDarkColor(e.target.value)} className="w-8 h-8 rounded cursor-pointer border-0" />
                  <Input value={darkColor} onChange={(e) => setDarkColor(e.target.value)} className="h-8 text-xs font-mono" data-testid="input-dark-color" />
                </div>
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-2">
            <Button variant="outline" onClick={onClose} data-testid="button-cancel-assoc">Cancel</Button>
            <Button onClick={handleSave} disabled={saving} data-testid="button-save-assoc">
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : null}
              {isEdit ? "Save Changes" : "Create Association"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
