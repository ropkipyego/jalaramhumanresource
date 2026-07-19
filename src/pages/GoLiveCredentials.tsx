import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { useRole } from "@/hooks/useRole";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import {
  AlertTriangle, Download, KeyRound, Loader2, RefreshCw, Search, ShieldAlert, Users,
} from "lucide-react";
import { DEFAULT_TEMP_PASSWORD } from "@/lib/tempPassword";
import { invokeEdgeFunction } from "@/lib/edgeFunctions";

interface StaffRow {
  id: string;
  staff_id: string;
  full_name: string;
  email: string;
  login_email: string;
  role: string;
  is_active: boolean;
  hr_status: string;
  has_auth_account: boolean;
  last_sign_in_at: string | null;
  must_change_password?: boolean;
}

interface CredentialRow {
  staff_id: string;
  full_name: string;
  email: string;
  role: string;
  password: string;
  status: "reset" | "error" | "skipped";
  reason?: string;
}

export default function GoLiveCredentials() {
  const { hasRole } = useRole();
  const canAccess = hasRole("ADMIN");

  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [credentials, setCredentials] = useState<CredentialRow[] | null>(null);
  const [edgeHint, setEdgeHint] = useState<string | null>(null);

  /** List staff from DB (no edge function required). Auth account flag is best-effort. */
  const load = async () => {
    setLoading(true);
    setEdgeHint(null);
    const { data: profiles, error: pErr } = await supabase
      .from("profiles")
      .select("id, staff_id, full_name, email, is_active, hr_status, must_change_password")
      .order("full_name");
    if (pErr) {
      setLoading(false);
      toast.error(
        pErr.message.includes("must_change_password")
          ? "Run the must_change_password migration in Supabase SQL Editor first."
          : pErr.message
      );
      // Retry without the new column so roster still loads
      const { data: fallback } = await supabase
        .from("profiles")
        .select("id, staff_id, full_name, email, is_active, hr_status")
        .order("full_name");
      if (!fallback) return;
      const { data: roles } = await supabase.from("user_roles").select("user_id, role");
      const roleMap = new Map((roles || []).map((r: any) => [r.user_id, r.role]));
      setStaff(
        fallback.map((p: any) => ({
          id: p.id,
          staff_id: p.staff_id,
          full_name: p.full_name,
          email: p.email,
          login_email: p.email,
          role: roleMap.get(p.id) || "STAFF",
          is_active: p.is_active,
          hr_status: p.hr_status,
          has_auth_account: true,
          last_sign_in_at: null,
        }))
      );
      setLoading(false);
      return;
    }

    const { data: roles } = await supabase.from("user_roles").select("user_id, role");
    const roleMap = new Map((roles || []).map((r: any) => [r.user_id, r.role]));
    setStaff(
      (profiles || []).map((p: any) => ({
        id: p.id,
        staff_id: p.staff_id,
        full_name: p.full_name,
        email: p.email,
        login_email: p.email,
        role: roleMap.get(p.id) || "STAFF",
        is_active: p.is_active,
        hr_status: p.hr_status,
        has_auth_account: true,
        last_sign_in_at: null,
        must_change_password: p.must_change_password,
      }))
    );
    setLoading(false);
  };

  useEffect(() => {
    if (canAccess) load();
  }, [canAccess]);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return staff;
    return staff.filter(
      (r) =>
        r.full_name?.toLowerCase().includes(s) ||
        r.staff_id?.toLowerCase().includes(s) ||
        r.login_email?.toLowerCase().includes(s) ||
        r.email?.toLowerCase().includes(s)
    );
  }, [staff, search]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAllFiltered = () => {
    const ids = filtered.filter((r) => r.has_auth_account).map((r) => r.id);
    const allSelected = ids.length > 0 && ids.every((id) => selected.has(id));
    setSelected((prev) => {
      const next = new Set(prev);
      if (allSelected) ids.forEach((id) => next.delete(id));
      else ids.forEach((id) => next.add(id));
      return next;
    });
  };

  const downloadRoster = () => {
    const rows = filtered.map((r) => ({
      "Staff ID": r.staff_id,
      "Full Name": r.full_name,
      "Login Email": r.login_email,
      Role: r.role,
      Status: r.hr_status,
      Active: r.is_active ? "Yes" : "No",
      "Must Change Password": r.must_change_password ? "Yes" : "No",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Staff Logins");
    XLSX.writeFile(wb, `staff-login-roster-${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success("Roster downloaded");
  };

  const downloadCredentials = (rows: CredentialRow[]) => {
    const ready = rows.filter((r) => r.status === "reset");
    const aoa = [
      ["Staff ID", "Full Name", "Login Email", "Temporary Password", "Role", "Status", "Notes"],
      ...rows.map((r) => [
        r.staff_id, r.full_name, r.email, r.password, r.role, r.status, r.reason || "",
      ]),
    ];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws["!cols"] = [{ wch: 14 }, { wch: 24 }, { wch: 32 }, { wch: 16 }, { wch: 12 }, { wch: 10 }, { wch: 40 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Credentials");
    XLSX.writeFile(wb, `go-live-credentials-${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success(`Downloaded ${ready.length} rows — password is ${DEFAULT_TEMP_PASSWORD}`);
  };

  const resetPasswords = async (allActive: boolean) => {
    const user_ids = allActive ? [] : Array.from(selected);
    if (!allActive && user_ids.length === 0) {
      toast.error("Select at least one staff member, or use Reset All Active");
      return;
    }

    const label = allActive
      ? `Reset ALL active staff passwords to ${DEFAULT_TEMP_PASSWORD}?`
      : `Reset ${user_ids.length} selected staff to ${DEFAULT_TEMP_PASSWORD}?`;
    if (!confirm(`${label}\n\nThey must change password on next login.`)) {
      return;
    }

    setBusy(true);
    const { data, error } = await invokeEdgeFunction<{
      credentials: CredentialRow[];
      reset_count: number;
      error?: string;
    }>("go-live-credentials", {
      body: { action: "reset_passwords", user_ids, password: DEFAULT_TEMP_PASSWORD },
    });
    setBusy(false);

    if (error) {
      setEdgeHint(error);
      toast.error(error);
      return;
    }

    const creds = data?.credentials || [];
    setCredentials(creds);
    if (creds.length) downloadCredentials(creds);
    toast.success(`Reset ${data?.reset_count ?? 0} passwords to ${DEFAULT_TEMP_PASSWORD}`);
    load();
  };

  if (!canAccess) return <Navigate to="/dashboard" replace />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Go-Live Credentials</h1>
        <p className="text-muted-foreground">
          Reset every login to the shared temporary password <code className="font-mono">ChangeMe123!</code>.
          Staff are forced to change it on first sign-in.
        </p>
      </div>

      <Alert>
        <ShieldAlert className="h-4 w-4" />
        <AlertTitle>Going live — how to get every staff login</AlertTitle>
        <AlertDescription className="space-y-2 text-sm">
          <p>
            <strong>Passwords cannot be recovered</strong> from the database (they are hashed).
            Use this page to list every login email, then reset passwords to <code className="font-mono">ChangeMe123!</code> and download the Excel once.
          </p>
          <ol className="list-decimal pl-5 space-y-1">
            <li>Deploy: <code className="text-xs">supabase functions deploy go-live-credentials</code></li>
            <li>Run DB migration for <code className="text-xs">must_change_password</code> in Supabase (not Vercel)</li>
            <li>Click <strong>Refresh roster</strong> to load all staff emails</li>
            <li>Click <strong>Reset ALL active logins</strong> (or select people)</li>
            <li>Everyone gets <code className="font-mono">ChangeMe123!</code> and must change it after login</li>
            <li>Share each email privately with that staff member</li>
          </ol>
          <p>
            Alternative (CLI): set <code className="text-xs">SUPABASE_SERVICE_ROLE_KEY</code> then run{" "}
            <code className="text-xs">node scripts/export-staff-logins.mjs --reset</code>
          </p>
        </AlertDescription>
      </Alert>

      {edgeHint && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Edge Function not deployed</AlertTitle>
          <AlertDescription className="space-y-2 text-sm">
            <p>{edgeHint}</p>
            <p>
              From your machine (logged into Supabase CLI linked to project <code>sfziuvxfeyfhkzmcxpou</code>):
            </p>
            <pre className="rounded bg-muted p-2 text-xs overflow-x-auto">supabase functions deploy go-live-credentials{"\n"}supabase functions deploy bulk-create-staff{"\n"}supabase functions deploy create-staff-user</pre>
            <p>Roster list still works from the database. Password reset needs the function.</p>
          </AlertDescription>
        </Alert>
      )}

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={load} disabled={loading}>
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
          Refresh roster
        </Button>
        <Button variant="outline" onClick={downloadRoster} disabled={!staff.length}>
          <Download className="mr-2 h-4 w-4" /> Download login emails
        </Button>
        <Button
          variant="secondary"
          onClick={() => resetPasswords(false)}
          disabled={busy || selected.size === 0}
        >
          {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <KeyRound className="mr-2 h-4 w-4" />}
          Reset selected ({selected.size})
        </Button>
        <Button
          onClick={() => resetPasswords(true)}
          disabled={busy || !staff.some((s) => s.has_auth_account && s.is_active)}
        >
          {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <KeyRound className="mr-2 h-4 w-4" />}
          Reset ALL active logins
        </Button>
      </div>

      {credentials && (
        <Alert className="border-warning">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Credentials generated</AlertTitle>
          <AlertDescription className="flex flex-wrap items-center gap-3">
            <span>
              {credentials.filter((c) => c.status === "reset").length} reset ·{" "}
              {credentials.filter((c) => c.status === "skipped").length} skipped ·{" "}
              {credentials.filter((c) => c.status === "error").length} errors
            </span>
            <Button size="sm" variant="outline" onClick={() => downloadCredentials(credentials)}>
              <Download className="mr-2 h-4 w-4" /> Download again
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" /> Staff login roster
              </CardTitle>
              <CardDescription>
                {staff.length} profiles · {staff.filter((s) => s.has_auth_account).length} with auth accounts
              </CardDescription>
            </div>
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Search name, staff ID, email…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={
                        filtered.filter((r) => r.has_auth_account).length > 0 &&
                        filtered.filter((r) => r.has_auth_account).every((r) => selected.has(r.id))
                      }
                      onCheckedChange={toggleAllFiltered}
                    />
                  </TableHead>
                  <TableHead>Staff</TableHead>
                  <TableHead>Login Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Auth</TableHead>
                  <TableHead>Last login</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-10">
                      No staff found. Create users via Invite Staff or Bulk Upload first.
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>
                        <Checkbox
                          disabled={!r.has_auth_account}
                          checked={selected.has(r.id)}
                          onCheckedChange={() => toggle(r.id)}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{r.full_name}</div>
                        <div className="text-xs text-muted-foreground">{r.staff_id}</div>
                      </TableCell>
                      <TableCell className="font-mono text-sm">{r.login_email}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{r.role}</Badge>
                      </TableCell>
                      <TableCell>
                        {r.has_auth_account ? (
                          <Badge>Ready</Badge>
                        ) : (
                          <Badge variant="destructive">No login</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {r.last_sign_in_at
                          ? new Date(r.last_sign_in_at).toLocaleString()
                          : "Never"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
