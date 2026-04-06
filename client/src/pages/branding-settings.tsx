import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest, getQueryFn } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Palette, Save, RotateCcw, Loader2 } from "lucide-react";

interface BrandingData {
  companyName: string;
  logoUrl?: string;
  faviconUrl?: string;
  primaryColor: string;
  sidebarColor: string;
  accentColor: string;
  footerText?: string;
}

const DEFAULTS: BrandingData = {
  companyName: "Vine Management",
  primaryColor: "#317C3C",
  sidebarColor: "#1B3E1E",
  accentColor: "#8BC53F",
  footerText: "",
};

export default function BrandingSettings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: current, isLoading } = useQuery<BrandingData>({
    queryKey: ["/api/branding"],
    queryFn: getQueryFn({ on401: "returnNull" }),
  });

  const [form, setForm] = useState<BrandingData>(DEFAULTS);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (current) {
      setForm({ ...DEFAULTS, ...current });
    }
  }, [current]);

  function updateField(field: keyof BrandingData, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setHasChanges(true);
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PATCH", "/api/branding", form);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/branding"] });
      setHasChanges(false);
      toast({ title: "Branding updated", description: "Changes applied across the app." });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to save", description: err.message, variant: "destructive" });
    },
  });

  function handleReset() {
    if (current) {
      setForm({ ...DEFAULTS, ...current });
    } else {
      setForm(DEFAULTS);
    }
    setHasChanges(false);
  }

  if (isLoading) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 bg-muted rounded" />
          <div className="h-64 bg-muted rounded-lg" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <Palette className="w-5 h-5" />
            Branding
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Customize your organization's appearance</p>
        </div>
        <div className="flex items-center gap-2">
          {hasChanges && (
            <Button variant="outline" size="sm" onClick={handleReset}>
              <RotateCcw className="w-3.5 h-3.5 mr-1" />
              Reset
            </Button>
          )}
          <Button
            size="sm"
            onClick={() => saveMutation.mutate()}
            disabled={!hasChanges || saveMutation.isPending}
          >
            {saveMutation.isPending ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Save className="w-3.5 h-3.5 mr-1" />}
            Save
          </Button>
        </div>
      </div>

      <div className="space-y-6">
        {/* Company Info */}
        <Card>
          <CardContent className="p-5 space-y-4">
            <h2 className="text-sm font-semibold">Company Information</h2>
            <div className="space-y-3">
              <div>
                <Label htmlFor="companyName" className="text-xs">Company Name</Label>
                <Input
                  id="companyName"
                  value={form.companyName}
                  onChange={(e) => updateField("companyName", e.target.value)}
                  placeholder="Vine Management"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="footerText" className="text-xs">Footer Text</Label>
                <Textarea
                  id="footerText"
                  value={form.footerText || ""}
                  onChange={(e) => updateField("footerText", e.target.value)}
                  placeholder="Managed by Vine Management Group"
                  className="mt-1"
                  rows={2}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Colors */}
        <Card>
          <CardContent className="p-5 space-y-4">
            <h2 className="text-sm font-semibold">Brand Colors</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="primaryColor" className="text-xs">Primary Color</Label>
                <div className="flex items-center gap-2 mt-1">
                  <input
                    type="color"
                    id="primaryColor"
                    value={form.primaryColor}
                    onChange={(e) => updateField("primaryColor", e.target.value)}
                    className="w-8 h-8 rounded border cursor-pointer"
                  />
                  <Input
                    value={form.primaryColor}
                    onChange={(e) => updateField("primaryColor", e.target.value)}
                    className="font-mono text-xs"
                    maxLength={7}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="sidebarColor" className="text-xs">Sidebar Color</Label>
                <div className="flex items-center gap-2 mt-1">
                  <input
                    type="color"
                    id="sidebarColor"
                    value={form.sidebarColor}
                    onChange={(e) => updateField("sidebarColor", e.target.value)}
                    className="w-8 h-8 rounded border cursor-pointer"
                  />
                  <Input
                    value={form.sidebarColor}
                    onChange={(e) => updateField("sidebarColor", e.target.value)}
                    className="font-mono text-xs"
                    maxLength={7}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="accentColor" className="text-xs">Accent Color</Label>
                <div className="flex items-center gap-2 mt-1">
                  <input
                    type="color"
                    id="accentColor"
                    value={form.accentColor}
                    onChange={(e) => updateField("accentColor", e.target.value)}
                    className="w-8 h-8 rounded border cursor-pointer"
                  />
                  <Input
                    value={form.accentColor}
                    onChange={(e) => updateField("accentColor", e.target.value)}
                    className="font-mono text-xs"
                    maxLength={7}
                  />
                </div>
              </div>
            </div>

            {/* Live preview */}
            <div className="mt-4 p-4 rounded-lg border">
              <p className="text-xs text-muted-foreground mb-2">Preview</p>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg" style={{ backgroundColor: form.sidebarColor }} />
                <div className="flex items-center gap-2">
                  <div className="px-3 py-1.5 rounded text-xs font-medium text-white" style={{ backgroundColor: form.primaryColor }}>
                    Primary Button
                  </div>
                  <div className="px-3 py-1.5 rounded text-xs font-medium border" style={{ borderColor: form.accentColor, color: form.accentColor }}>
                    Accent
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
