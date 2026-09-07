import { useEffect, useMemo, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useRole } from "@/hooks/useRole";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import {
  ExternalLink, KeyRound, Loader2, Mail, Search, ShieldAlert, Trash2, Users,
} from "lucide-react";
import { DEFAULT_TEMP_PASSWORD } from "@/lib/tempPassword";
import { STAFF_EMAIL_DOMAIN, normalizeStaffEmail } from "@/lib/staffEmail";

type Row = {
  id: string;
  staff_id: string;
  full_name: string;
  email: string;
  is_active: boolean | null;
  hr_status: string | null;
  must_change_password?: boolean | null;
};

export default function UserAccounts() {
  const { user } = useAuth();
  const { canManageStaffLogins, isSuperAdmin } = useRole();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [emailEdit, setEmailEdit] = useState<{ id: string; email: string; name: string } | null>(null);
  const [purgeTarget, setPurgeTarget] = useState<Row | null>(null);
  const [purgeConfirm, setPurgeConfirm] = useState("");

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("profiles")
      .select("id, staff_id, full_name, email, is_active, hr_status, must_change_password")
      .order("full_name");
    if (error) {
      // Column may be missing on older DBs
      const fallback = await supabase
        .from("profiles")
        .select("id, staff_id, full_name, email, is_active, hr_status")
        .order("full_name");
      if (fallback.error) toast.error(fallback.error.message);
      setRows((fallback.data as Row[]) || []);
    } else {
      setRows((data as Row[]) || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (canManageStaffLogins) load();
  }, [canManageStaffLogins]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.full_name?.toLowerCase().includes(q) ||
        r.email?.toLowerCase().includes(q) ||
        r.staff_id?.toLowerCase().includes(q)
    );
  }, [rows, search]);

  if (!canManageStaffLogins) return <Navigate to="/dashboard" replace />;

  const saveEmail = async () => {
    if (!emailEdit) return;
    const { email, error: normErr } = normalizeStaffEmail(emailEdit.email);
    if (normErr) return toast.error(normErr);
    setBusyId(emailEdit.id);
    const { error } = await (supabase as any).rpc("admin_update_staff_email", {
      _user_id: emailEdit.id,
      _email: email,
    });
    setBusyId(null);
    if (error) return toast.error(error.message);
    toast.success(`Email updated to ${email}`);
    setEmailEdit(null);
    load();
  };

  const resetPassword = async (r: Row) => {
    if (!confirm(`Reset ${r.full_name} to ${DEFAULT_TEMP_PASSWORD}? They must change it on next login.`)) return;
    setBusyId(r.id);
    const { error } = await (supabase as any).rpc("admin_reset_staff_password", {
      _user_id: r.id,
      _password: DEFAULT_TEMP_PASSWORD,
    });
    setBusyId(null);
    if (error) return toast.error(error.message);
    toast.success(`Password reset for ${r.full_name}`);
    load();
  };

  const purge = async () => {
    if (!purgeTarget || !isSuperAdmin) return;
    setBusyId(purgeTarget.id);
    const { data, error } = await (supabase as any).rpc("admin_purge_staff", {
      _user_id: purgeTarget.id,
      _confirm: purgeConfirm,
    });
    setBusyId(null);
    if (error) return toast.error(error.message);
    toast.success(data?.message || "Done");
    setPurgeTarget(null);
    setPurgeConfirm("");
    load();
  };

  return (
    <div className="space-y-6 max-w-6xl animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Users className="h-8 w-8 text-primary" /> User Accounts
        </h1>
        <p className="text-muted-foreground">
          Fix login emails and passwords in the portal — no Edge Functions needed. SUPER_ADMIN can permanently remove duplicate accounts.
        </p>
      </div>

      <Alert>
        <ShieldAlert className="h-4 w-4" />
        <AlertTitle>How to use</AlertTitle>
        <AlertDescription className="text-sm space-y-1">
          <p><strong>Change email</strong> on the correct person — do not create a second account.</p>
          <p><strong>Reset password</strong> → temporary <code className="font-mono">{DEFAULT_TEMP_PASSWORD}</code>.</p>
          <p><strong>Purge</strong> (SUPER_ADMIN only) for mistaken duplicates. Real leavers → use Offboard on the employee file so history stays.</p>
          <p className="text-muted-foreground">
            First time: run SQL file <code className="text-xs">scripts/admin-account-rpcs.sql</code> in Supabase SQL Editor.
          </p>
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Staff logins</CardTitle>
          <CardDescription>{filtered.length} of {rows.length} shown</CardDescription>
          <div className="relative max-w-md pt-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search name, email, staff ID…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Staff ID</TableHead>
                  <TableHead>Login email</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => (
                  <TableRow key={r.id} className={r.id === user?.id ? "bg-muted/40" : undefined}>
                    <TableCell className="font-medium">
                      {r.full_name}
                      {r.id === user?.id && <Badge variant="outline" className="ml-2">You</Badge>}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{r.staff_id}</TableCell>
                    <TableCell className="font-mono text-sm">{r.email}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        <Badge variant={r.is_active === false ? "secondary" : "default"}>
                          {r.hr_status || (r.is_active === false ? "INACTIVE" : "ACTIVE")}
                        </Badge>
                        {r.must_change_password && <Badge variant="outline">Must change pwd</Badge>}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1 flex-wrap">
                        <Button
                          size="sm"
                          variant="ghost"
                          title="Change email"
                          disabled={busyId === r.id}
                          onClick={() => setEmailEdit({ id: r.id, email: r.email || "", name: r.full_name })}
                        >
                          <Mail className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          title="Reset password"
                          disabled={busyId === r.id}
                          onClick={() => resetPassword(r)}
                        >
                          {busyId === r.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
                        </Button>
                        <Button size="sm" variant="ghost" asChild title="Employee file">
                          <Link to={`/staff/${r.id}`}><ExternalLink className="h-4 w-4" /></Link>
                        </Button>
                        {isSuperAdmin && r.id !== user?.id && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive"
                            title="Permanently delete"
                            disabled={busyId === r.id}
                            onClick={() => { setPurgeTarget(r); setPurgeConfirm(""); }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!emailEdit} onOpenChange={(o) => !o && setEmailEdit(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change login email</DialogTitle>
            <DialogDescription>
              Updates Auth login and profile for {emailEdit?.name}. Must be @{STAFF_EMAIL_DOMAIN}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>New email</Label>
            <Input
              type="email"
              value={emailEdit?.email ?? ""}
              onChange={(e) => setEmailEdit((x) => x ? { ...x, email: e.target.value } : x)}
              placeholder={`name@${STAFF_EMAIL_DOMAIN}`}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEmailEdit(null)}>Cancel</Button>
            <Button onClick={saveEmail} disabled={!!busyId}>
              {busyId ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Mail className="h-4 w-4 mr-2" />}
              Save email
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!purgeTarget} onOpenChange={(o) => !o && setPurgeTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-destructive">Permanently delete account?</DialogTitle>
            <DialogDescription className="space-y-2">
              <p>
                This removes <strong>{purgeTarget?.full_name}</strong> ({purgeTarget?.email}).
                Prefer <strong>Offboard</strong> for real leavers so payroll history stays.
              </p>
              <p>Use Purge for duplicate / mistaken accounts only.</p>
              <p>Type <code className="font-mono">DELETE</code> to confirm.</p>
            </DialogDescription>
          </DialogHeader>
          <Input
            value={purgeConfirm}
            onChange={(e) => setPurgeConfirm(e.target.value)}
            placeholder="DELETE"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setPurgeTarget(null)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={purgeConfirm !== "DELETE" || !!busyId}
              onClick={purge}
            >
              {busyId ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
              Purge forever
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
