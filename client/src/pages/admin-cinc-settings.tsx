import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Settings, RefreshCw, Loader2, CheckCircle, XCircle,
  Clock, AlertTriangle, Key, Globe, Activity, ScrollText,
  Zap, Building2, ShieldCheck,
} from "lucide-react";

interface CincSettings {
  clientId: string;
  clientSecret: string;
  environment: "uat" | "production";
  scope: string;
  enabled: boolean;
  lastSyncAt: string | null;
  syncStatus: "idle" | "syncing" | "error" | "success";
  syncLog: Array<{ timestamp: string; message: string; type: "info" | "error" | "success" }>;
  lastSyncData?: {
    associations: number;
    vendors: number;
    workOrders: number;
  };
}

interface TestResult {
  success: boolean;
  environment: string;
  totalAssociations: number;
  activeAssociations: number;
  associations: Array<{
    id: number;
    code: string;
    name: string;
    units: number;
    active: boolean;
    city: string;
    state: string;
  }>;
}

export default function AdminCincSettingsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [showSecret, setShowSecret] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const isSuperAdmin = user?.role === "super_admin";

  const { data: settings, isLoading } = useQuery<CincSettings>({
    queryKey: ["/api/cinc/settings"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/cinc/settings");
      return res.json();
    },
    refetchInterval: (query) => {
      const data = query.state.data as CincSettings | undefined;
      return data?.syncStatus === "syncing" ? 2000 : false;
    },
  });

  const [form, setForm] = useState<{
    clientId: string;
    clientSecret: string;
    environment: "uat" | "production";
    scope: string;
    enabled: boolean;
  } | null>(null);

  useEffect(() => {
    if (settings && !form) {
      setForm({
        clientId: settings.clientId,
        clientSecret: settings.clientSecret,
        environment: settings.environment,
        scope: settings.scope,
        enabled: settings.enabled,
      });
    }
  }, [settings]);

  const currentForm = form || {
    clientId: "",
    clientSecret: "",
    environment: "uat" as const,
    scope: "cincapi.all",
    enabled: false,
  };

  const saveMutation = useMutation({
    mutationFn: async (data: typeof currentForm) => {
      const res = await apiRequest("PATCH", "/api/cinc/settings", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cinc/settings"] });
      toast({ title: "Settings saved" });
    },
  });

  const testMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/cinc/test", currentForm);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Connection test failed");
      }
      return res.json() as Promise<TestResult>;
    },
    onSuccess: (data) => {
      setTestResult(data);
      queryClient.invalidateQueries({ queryKey: ["/api/cinc/settings"] });
      toast({ title: `Connected: ${data.totalAssociations} associations found` });
    },
    onError: (err: any) => {
      setTestResult(null);
      toast({ title: "Connection failed", description: err.message, variant: "destructive" });
    },
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/cinc/sync");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cinc/settings"] });
      toast({ title: "Sync started" });
    },
    onError: () => {
      toast({ title: "Sync failed", variant: "destructive" });
    },
  });

  function handleSave() {
    saveMutation.mutate(currentForm);
  }

  function updateForm(key: string, value: any) {
    setForm({ ...currentForm, [key]: value });
  }

  if (isLoading) {
    return (
      <div className="p-6 max-w-3xl mx-auto space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-48" />
        <Skeleton className="h-36" />
      </div>
    );
  }

  const statusIcon = {
    idle: <Clock className="w-4 h-4 text-muted-foreground" />,
    syncing: <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />,
    success: <CheckCircle className="w-4 h-4 text-green-500" />,
    error: <XCircle className="w-4 h-4 text-red-500" />,
  };

  const statusLabel = {
    idle: "No sync run yet",
    syncing: "Syncing...",
    success: "Last sync successful",
    error: "Last sync failed",
  };

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-lg font-bold flex items-center gap-2" data-testid="text-cinc-title">
          <Settings className="w-5 h-5" />
          CINC Integration
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Connect to CINC Systems using OAuth2 client credentials
        </p>
      </div>

      {/* Connection settings */}
      <Card className="mb-4">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <ShieldCheck className="w-4 h-4" />
            OAuth2 Credentials
          </CardTitle>
          <CardDescription className="text-xs">
            Enter your CINC API client credentials to authenticate
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium">Enable Integration</Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Turn on automatic data synchronization
              </p>
            </div>
            <Switch
              checked={currentForm.enabled}
              onCheckedChange={(v) => updateForm("enabled", v)}
              disabled={!isSuperAdmin}
              data-testid="switch-cinc-enabled"
            />
          </div>

          <Separator />

          <div>
            <Label className="text-xs mb-1.5 block">Environment</Label>
            <Select
              value={currentForm.environment}
              onValueChange={(v) => updateForm("environment", v)}
              disabled={!isSuperAdmin}
            >
              <SelectTrigger className="h-9" data-testid="select-cinc-env">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="uat">UAT / Sandbox</SelectItem>
                <SelectItem value="production">Production</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground mt-1">
              {currentForm.environment === "uat"
                ? "Using integration.cincsys.io (test data)"
                : "Using vinemgmt.cincsys.com (live data)"}
            </p>
          </div>

          <div>
            <Label className="text-xs mb-1.5 block">Client ID</Label>
            <div className="flex items-center gap-2">
              <Key className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <Input
                value={currentForm.clientId}
                onChange={(e) => updateForm("clientId", e.target.value)}
                placeholder="e.g. 5a2fdaa8-be36-4e05-9a1f-0f658ccd22b4"
                disabled={!isSuperAdmin}
                className="h-9 font-mono text-xs"
                data-testid="input-cinc-client-id"
              />
            </div>
          </div>

          <div>
            <Label className="text-xs mb-1.5 block">Client Secret</Label>
            <div className="flex items-center gap-2">
              <Key className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <Input
                type={showSecret ? "text" : "password"}
                value={currentForm.clientSecret}
                onChange={(e) => updateForm("clientSecret", e.target.value)}
                placeholder="Enter your CINC client secret"
                disabled={!isSuperAdmin}
                className="h-9 font-mono text-xs"
                data-testid="input-cinc-secret"
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowSecret(!showSecret)}
                className="text-xs h-9 px-3"
                data-testid="button-toggle-secret"
              >
                {showSecret ? "Hide" : "Show"}
              </Button>
            </div>
          </div>

          <div>
            <Label className="text-xs mb-1.5 block">Scope</Label>
            <Input
              value={currentForm.scope}
              onChange={(e) => updateForm("scope", e.target.value)}
              placeholder="cincapi.all"
              disabled={!isSuperAdmin}
              className="h-9 font-mono text-xs"
              data-testid="input-cinc-scope"
            />
            <p className="text-[11px] text-muted-foreground mt-1">
              Use "cincapi.all" for full access, or a specific scope if restricted
            </p>
          </div>

          {isSuperAdmin && (
            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => testMutation.mutate()}
                disabled={testMutation.isPending || !currentForm.clientId || !currentForm.clientSecret}
                data-testid="button-test-cinc"
              >
                {testMutation.isPending ? (
                  <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                ) : (
                  <Zap className="w-4 h-4 mr-1" />
                )}
                Test Connection
              </Button>
              <Button
                onClick={handleSave}
                disabled={saveMutation.isPending}
                size="sm"
                data-testid="button-save-cinc"
              >
                {saveMutation.isPending && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
                Save Settings
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Test connection result */}
      {testResult && (
        <Card className="mb-4 border-green-200 dark:border-green-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2 text-green-700 dark:text-green-400">
              <CheckCircle className="w-4 h-4" />
              Connection Verified ({testResult.environment.toUpperCase()})
            </CardTitle>
            <CardDescription className="text-xs">
              {testResult.totalAssociations} total associations, {testResult.activeAssociations} active
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-1.5 max-h-48 overflow-y-auto">
              {testResult.associations.map((assoc) => (
                <div
                  key={assoc.id}
                  className="flex items-center justify-between text-xs py-1.5 px-2 rounded bg-muted/50"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Building2 className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                    <span className="font-mono text-muted-foreground">{assoc.code}</span>
                    <span className="truncate">{assoc.name}</span>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-muted-foreground">{assoc.units} units</span>
                    <Badge variant={assoc.active ? "default" : "secondary"} className="text-[10px] px-1.5 py-0">
                      {assoc.active ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                </div>
              ))}
              {testResult.totalAssociations > 10 && (
                <p className="text-[11px] text-muted-foreground text-center py-1">
                  ... and {testResult.totalAssociations - 10} more
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Sync controls */}
      <Card className="mb-4">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <RefreshCw className="w-4 h-4" />
            Synchronization
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              {settings && statusIcon[settings.syncStatus]}
              <div>
                <p className="text-sm font-medium">{settings && statusLabel[settings.syncStatus]}</p>
                {settings?.lastSyncAt && (
                  <p className="text-xs text-muted-foreground">
                    {new Date(settings.lastSyncAt).toLocaleString()}
                  </p>
                )}
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => syncMutation.mutate()}
              disabled={syncMutation.isPending || settings?.syncStatus === "syncing" || !currentForm.clientId}
              data-testid="button-sync-cinc"
            >
              {(syncMutation.isPending || settings?.syncStatus === "syncing") ? (
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4 mr-1" />
              )}
              Sync Now
            </Button>
          </div>

          {/* Last sync summary */}
          {settings?.lastSyncData && (
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="text-center py-2 px-3 bg-muted/50 rounded-md">
                <p className="text-lg font-bold">{settings.lastSyncData.associations}</p>
                <p className="text-[10px] text-muted-foreground">Associations</p>
              </div>
              <div className="text-center py-2 px-3 bg-muted/50 rounded-md">
                <p className="text-lg font-bold">{settings.lastSyncData.vendors}</p>
                <p className="text-[10px] text-muted-foreground">Vendors</p>
              </div>
              <div className="text-center py-2 px-3 bg-muted/50 rounded-md">
                <p className="text-lg font-bold">{settings.lastSyncData.workOrders}</p>
                <p className="text-[10px] text-muted-foreground">Work Orders</p>
              </div>
            </div>
          )}

          {!currentForm.clientId && (
            <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-md px-3 py-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              Configure credentials above to run sync
            </div>
          )}

          <div className="mt-4 text-xs text-muted-foreground space-y-1">
            <p className="font-medium text-foreground flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5" />
              Available data from CINC:
            </p>
            <ul className="list-disc list-inside space-y-0.5 ml-5">
              <li>Associations (names, addresses, unit counts, manager assignments)</li>
              <li>Vendors (contacts, insurance, services, tax info)</li>
              <li>Work Orders (status, descriptions, vendor assignments, notes)</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Sync log */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <ScrollText className="w-4 h-4" />
            Activity Log
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!settings?.syncLog?.length ? (
            <p className="text-sm text-muted-foreground text-center py-6">No activity yet</p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {settings.syncLog.map((entry, i) => (
                <div key={i} className="flex items-start gap-2 text-xs">
                  <span className="flex-shrink-0 mt-0.5">
                    {entry.type === "success" ? (
                      <CheckCircle className="w-3.5 h-3.5 text-green-500" />
                    ) : entry.type === "error" ? (
                      <XCircle className="w-3.5 h-3.5 text-red-500" />
                    ) : (
                      <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-foreground">{entry.message}</p>
                    <p className="text-muted-foreground text-[10px]">
                      {new Date(entry.timestamp).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
