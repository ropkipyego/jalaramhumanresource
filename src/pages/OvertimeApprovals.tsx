import { useEffect, useMemo, useState } from "react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useRole } from "@/hooks/useRole";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { CheckCircle2, Loader2, Timer, XCircle } from "lucide-react";

interface OtRow {
  id: string;
  employee_id: string;
  work_date: string;
  expected_shift_code: string | null;
  worked_minutes: number;
  ot_minutes: number;
  status: string;
  approval_status: string;
  employee?: { full_name: string; staff_id: string };
}

export default function OvertimeApprovals() {
  const { hasRole } = useRole();
  const canManage = hasRole("HEAD") || hasRole("ADMIN") || hasRole("SUPER_ADMIN");

  const [rows, setRows] = useState<OtRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [from, setFrom] = useState(format(startOfMonth(new Date()), "yyyy-MM-dd"));
  const [to, setTo] = useState(format(endOfMonth(new Date()), "yyyy-MM-dd"));
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showAllPending, setShowAllPending] = useState(false);

  const load = async () => {
    setLoading(true);
    let q = supabase
      .from("attendance_daily")
      .select("id, employee_id, work_date, expected_shift_code, worked_minutes, ot_minutes, status, approval_status, employee:profiles(full_name, staff_id)")
      .gte("work_date", from)
      .lte("work_date", to)
      .eq("approval_status", "PENDING")
      .order("work_date", { ascending: false })
      .limit(500);
    if (!showAllPending) q = q.gt("ot_minutes", 0);
    const { data, error } = await q;
    if (error) toast.error(error.message);
    setRows((data as OtRow[]) || []);
    setSelected(new Set());
    setLoading(false);
  };

  useEffect(() => {
    if (canManage) load();
  }, [from, to, showAllPending, canManage]);

  const allIds = useMemo(() => rows.map((r) => r.id), [rows]);
  const allSelected = allIds.length > 0 && allIds.every((id) => selected.has(id));

  if (!canManage) return <Navigate to="/dashboard" replace />;

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(allIds));
  };

  const apply = async (status: "APPROVED" | "REJECTED") => {
    const ids = Array.from(selected);
    if (ids.length === 0) {
      toast.error("Select at least one row");
      return;
    }
    setBusy(true);
    const { data, error } = await (supabase as any).rpc("bulk_set_attendance_approval", {
      _ids: ids,
      _status: status,
      _zero_ot_on_reject: true,
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`${status === "APPROVED" ? "Approved" : "Rejected"} ${(data as any)?.updated ?? ids.length} day(s)`);
    load();
  };

  const fmtMins = (m: number) => (m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Overtime Approvals</h1>
        <p className="text-muted-foreground">
          Approve or reject pending OT before locking payroll. Rejected OT is zeroed and will not be paid.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Timer className="h-5 w-5" />
            Pending queue
          </CardTitle>
          <CardDescription>
            {rows.length} pending {showAllPending ? "attendance day(s)" : "OT day(s)"}
          </CardDescription>
          <div className="flex flex-wrap gap-3 items-end pt-2">
            <div>
              <label className="text-xs text-muted-foreground">From</label>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">To</label>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" />
            </div>
            <Button variant="outline" size="sm" onClick={() => setShowAllPending(!showAllPending)}>
              {showAllPending ? "OT only" : "All pending days"}
            </Button>
            <div className="flex gap-2 ml-auto">
              <Button variant="outline" disabled={busy || selected.size === 0} onClick={() => apply("REJECTED")}>
                {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <XCircle className="mr-2 h-4 w-4" />}
                Reject ({selected.size})
              </Button>
              <Button disabled={busy || selected.size === 0} onClick={() => apply("APPROVED")}>
                {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                Approve ({selected.size})
              </Button>
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
                    <Checkbox checked={allSelected} onCheckedChange={toggleAll} />
                  </TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Employee</TableHead>
                  <TableHead>Shift</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Worked</TableHead>
                  <TableHead>OT</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      Nothing pending in this range.
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>
                        <Checkbox checked={selected.has(r.id)} onCheckedChange={() => toggle(r.id)} />
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {format(new Date(r.work_date + "T00:00:00"), "dd MMM yyyy")}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{r.employee?.full_name}</div>
                        <div className="text-xs text-muted-foreground">{r.employee?.staff_id}</div>
                      </TableCell>
                      <TableCell>{r.expected_shift_code ?? "—"}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{r.status}</Badge>
                      </TableCell>
                      <TableCell>{fmtMins(r.worked_minutes)}</TableCell>
                      <TableCell className="font-medium">{r.ot_minutes > 0 ? fmtMins(r.ot_minutes) : "—"}</TableCell>
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
