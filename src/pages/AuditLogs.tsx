import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { useRole } from "@/hooks/useRole";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { FileText, Loader2, Search } from "lucide-react";
import type { AuditLog } from "@/types/database";

export default function AuditLogs() {
  const { hasRole } = useRole();
  const canView = hasRole("ADMIN");

  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [tableFilter, setTableFilter] = useState("all");

  useEffect(() => {
    if (!canView) return;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      if (!error) setLogs((data as AuditLog[]) || []);
      setLoading(false);
    })();
  }, [canView]);

  const tables = useMemo(() => [...new Set(logs.map((l) => l.table_name))].sort(), [logs]);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return logs.filter((l) => {
      if (tableFilter !== "all" && l.table_name !== tableFilter) return false;
      if (!s) return true;
      return (
        l.action.toLowerCase().includes(s) ||
        l.table_name.toLowerCase().includes(s) ||
        (l.record_id ?? "").toLowerCase().includes(s)
      );
    });
  }, [logs, search, tableFilter]);

  if (!canView) return <Navigate to="/dashboard" replace />;

  if (loading) return <div className="flex justify-center h-64 items-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Audit Logs</h1>
        <p className="text-muted-foreground">Privileged actions — salary changes, leave approvals, role assignments, and more.</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5" />Recent Activity</CardTitle>
              <CardDescription>Last 500 entries</CardDescription>
            </div>
            <div className="flex gap-2">
              <div className="relative w-48">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
              </div>
              <Select value={tableFilter} onValueChange={setTableFilter}>
                <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All tables</SelectItem>
                  {tables.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Table</TableHead>
                <TableHead>Record</TableHead>
                <TableHead>Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No audit entries found.</TableCell></TableRow>
              ) : filtered.map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="text-sm whitespace-nowrap">
                    {format(new Date(l.created_at), "dd MMM yyyy HH:mm")}
                  </TableCell>
                  <TableCell><Badge variant="outline">{l.action}</Badge></TableCell>
                  <TableCell className="font-mono text-xs">{l.table_name}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{l.record_id?.slice(0, 8) ?? "—"}…</TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-xs truncate">
                    {l.new_data ? JSON.stringify(l.new_data).slice(0, 80) : l.old_data ? `was: ${JSON.stringify(l.old_data).slice(0, 60)}` : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
