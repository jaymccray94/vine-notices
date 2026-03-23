import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { SafeUser, Association } from "@shared/schema";
import { ROLES } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Users, Shield, Loader2, Building2 } from "lucide-react";

const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super Admin",
  association_admin: "Association Admin",
  staff: "Staff (Read Only)",
};

const ROLE_COLORS: Record<string, string> = {
  super_admin: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  association_admin: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  staff: "bg-gray-100 text-gray-600 dark:bg-gray-800/50 dark:text-gray-400",
};

export default function AdminUsersPage() {
  const { toast } = useToast();
  const [editing, setEditing] = useState<SafeUser | null>(null);
  const [creating, setCreating] = useState(false);
  const [assigningUser, setAssigningUser] = useState<SafeUser | null>(null);

  const { data: users = [], isLoading } = useQuery<SafeUser[]>({
    queryKey: ["/api/users"],
  });

  const { data: associations = [] } = useQuery<Association[]>({
    queryKey: ["/api/associations"],
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/users/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({ title: "User deleted" });
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
          <h2 className="text-lg font-bold" data-testid="text-users-heading">Users</h2>
          <p className="text-sm text-muted-foreground">Manage team access and permissions</p>
        </div>
        <Button onClick={() => setCreating(true)} size="sm" data-testid="button-create-user">
          <Plus className="w-4 h-4 mr-1.5" />
          New User
        </Button>
      </div>

      {users.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Users className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm font-medium">No users yet</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {users.map((u) => (
            <Card key={u.id} className="hover:shadow-sm transition-shadow" data-testid={`card-user-${u.id}`}>
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-bold text-primary">{u.name.charAt(0).toUpperCase()}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-semibold text-sm">{u.name}</span>
                      <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${ROLE_COLORS[u.role]}`}>
                        {ROLE_LABELS[u.role]}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">{u.email}</p>
                    {u.role !== "super_admin" && u.associations && u.associations.length > 0 && (
                      <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                        {u.associations.map((a) => (
                          <Badge key={a.associationId} variant="outline" className="text-[10px] gap-1 h-5">
                            <Building2 className="w-2.5 h-2.5" />
                            {a.associationName}
                            <span className="text-muted-foreground">({a.permission})</span>
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {u.role !== "super_admin" && (
                      <Button variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={() => setAssigningUser(u)} data-testid={`button-assign-${u.id}`}>
                        <Shield className="w-3.5 h-3.5 mr-1" />
                        Assign
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setEditing(u)} data-testid={`button-edit-user-${u.id}`}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                      onClick={() => {
                        if (confirm(`Delete user "${u.name}"?`)) deleteMutation.mutate(u.id);
                      }}
                      data-testid={`button-delete-user-${u.id}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {(creating || editing) && (
        <UserDialog user={editing} onClose={() => { setCreating(false); setEditing(null); }} />
      )}

      {assigningUser && (
        <AssignDialog user={assigningUser} associations={associations} onClose={() => setAssigningUser(null)} />
      )}
    </div>
  );
}

function UserDialog({ user, onClose }: { user: SafeUser | null; onClose: () => void }) {
  const { toast } = useToast();
  const isEdit = !!user;
  const [name, setName] = useState(user?.name || "");
  const [email, setEmail] = useState(user?.email || "");
  const [role, setRole] = useState(user?.role || "association_admin");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!name.trim() || !email.trim()) {
      toast({ title: "Name and email are required", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      if (isEdit) {
        await apiRequest("PATCH", `/api/users/${user.id}`, { name, email, role });
      } else {
        await apiRequest("POST", "/api/users", { name, email, role });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({ title: isEdit ? "User updated" : "User created" });
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
          <DialogTitle>{isEdit ? "Edit User" : "New User"}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4 mt-2">
          <div className="flex flex-col gap-1.5">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Doe" data-testid="input-user-name" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Email</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jane@vinemgt.com" data-testid="input-user-email" />
            <p className="text-[11px] text-muted-foreground">Users sign in with a magic link sent to this email — no password needed.</p>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Role</Label>
            <Select value={role} onValueChange={(v: any) => setRole(v)}>
              <SelectTrigger data-testid="select-user-role"><SelectValue /></SelectTrigger>
              <SelectContent>
                {ROLES.map((r) => <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>)}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {role === "super_admin" && "Full access to all associations and settings."}
              {role === "association_admin" && "Can manage notices for assigned associations."}
              {role === "staff" && "Read-only access to assigned associations."}
            </p>
          </div>
          <div className="flex justify-end gap-2 mt-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving} data-testid="button-save-user">
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : null}
              {isEdit ? "Save Changes" : "Create User"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AssignDialog({
  user,
  associations,
  onClose,
}: {
  user: SafeUser;
  associations: Association[];
  onClose: () => void;
}) {
  const { toast } = useToast();
  const [assignments, setAssignments] = useState<Record<string, { checked: boolean; permission: "manage" | "readonly" }>>(
    () => {
      const map: Record<string, { checked: boolean; permission: "manage" | "readonly" }> = {};
      for (const a of associations) {
        const ua = user.associations?.find((x) => x.associationId === a.id);
        map[a.id] = { checked: !!ua, permission: ua?.permission || "manage" };
      }
      return map;
    }
  );
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      const arr = Object.entries(assignments)
        .filter(([, v]) => v.checked)
        .map(([associationId, v]) => ({ associationId, permission: v.permission }));
      await apiRequest("PUT", `/api/users/${user.id}/associations`, { assignments: arr });
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({ title: "Assignments updated" });
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
          <DialogTitle>Assign Associations — {user.name}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-2 mt-2 max-h-[400px] overflow-y-auto">
          {associations.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">No associations created yet.</p>
          )}
          {associations.map((a) => {
            const val = assignments[a.id];
            return (
              <div key={a.id} className="flex items-center gap-3 p-3 rounded-lg border">
                <Checkbox
                  checked={val?.checked}
                  onCheckedChange={(c) => setAssignments((p) => ({ ...p, [a.id]: { ...p[a.id], checked: !!c } }))}
                  data-testid={`checkbox-assoc-${a.id}`}
                />
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium">{a.name}</span>
                </div>
                {val?.checked && (
                  <Select
                    value={val.permission}
                    onValueChange={(v: any) => setAssignments((p) => ({ ...p, [a.id]: { ...p[a.id], permission: v } }))}
                  >
                    <SelectTrigger className="w-[120px] h-8 text-xs" data-testid={`select-permission-${a.id}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="manage">Manage</SelectItem>
                      <SelectItem value="readonly">Read Only</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>
            );
          })}
        </div>
        <div className="flex justify-end gap-2 mt-3">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving} data-testid="button-save-assignments">
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : null}
            Save Assignments
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
