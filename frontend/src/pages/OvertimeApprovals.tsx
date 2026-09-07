import { useEffect, useMemo, useState } from "react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { Navigate, Link } from "react-router-dom";
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
  shift_date: string;
  shift_type: string | null;
  scheduled_start: string | null;
  scheduled_end: string | null;
  actual_start: string | null;
  actual_end: string | null;
  worked_minutes: number;
  scheduled_minutes: number;
  overtime_minutes: number;
  overtime_status: string;
  status: string;
  anomaly_code: string | null;
  employee?: { full_name: string; staff_id: string } | null;
}

const fmtMins = (m: number) => (m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`);
const fmtTime = (v: string | null) => (v ? format(new Date(v), "HH:mm") : "—");

export default function OvertimeApprovals() {
  const { hasRole } = useRole();
  const canManage = hasRole("HEAD") || hasRole("ADMIN") || hasRole("SUPER_ADMIN");

  const [rows, setRows] = useState<OtRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [from, setFrom] = useState(format(startOfMonth(new Date()), "yyyy-MM-dd"));
  const [to, setTo] = useState(format(endOfMonth(new Date()), "yyyy-MM-dd"));
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showAnomalies, setShowAnomalies] = useState(false);

  const load = async () => {
    setLoading(true);
    let q = supabase
      .from("attendance_records" as never)
      .select(
        "id, employee_id, shift_date, shift_type, scheduled_start, scheduled_end, actual_start, actual_end, worked_minutes, scheduled_minutes, overtime_minutes, overtime_status, status, anomaly_code, employee:profiles(full_name, staff_id)",
      )
      .gte("shift_date", from)
      .lte("shift_date", to)
      .order("shift_date", { ascending: false })
      .limit(500);
    q = showAnomalies
      ? q.not("anomaly_code", "is", null)
      : q.eq("overtime_status", "PENDING_APPROVAL");
    const { data, error } = await q;
    if (error) toast.error(error.message);
    setRows((data as unknown as OtRow[]) || []);
    setSelected(new Set());
    setLoading(false);
  };

  useEffect(() => {
    if (canManage) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to, showAnomalies, canManage]);

  const allIds = useMemo(() => rows.map((r) => r.id), [rows]);
  const allSelected = allIds.length > 0 && allIds.every((id) => selected.has(id));

  if (!canManage) return <Navigate to="/dashboard" replace />;

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(allIds));

  const apply = async (status: "APPROVED" | "REJECTED") => {
    const ids = Array.from(selected);
    if (ids.length === 0) return toast.error("Select at least one shift");
    setBusy(true);
    const { data, error } = await supabase.rpc("set_overtime_approval" as never, {
      _ids: ids,
      _status: status,
    } as never);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(
      `${status === "APPROVED" ? "Approved" : "Rejected"} overtime on ${(data as { updated?: number })?.updated ?? ids.length} shift(s)`,
    );
    load();
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold">Overtime Approvals</h1>
        <p className="text-muted-foreground">
          Overtime is calculated by the engine but never paid until approved here. Rejected overtime is zeroed.
          Results come from <Link to="/attendance/process" className="underline">Attendance Processing</Link>.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Timer className="h-5 w-5" />
            {showAnomalies ? "Anomaly queue" : "Pending overtime"}
          </CardTitle>
          <CardDescription>
            {rows.length} {showAnomalies ? "shift(s) needing review" : "shift(s) with overtime awaiting a decision"}
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
            <Button variant="outline" size="sm" onClick={() => setShowAnomalies(!showAnomalies)}>
              {showAnomalies ? "Show pending OT" : "Show anomalies"}
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
            <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10"><Checkbox checked={allSelected} onCheckedChange={toggleAll} /></TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Employee</TableHead>
                  <TableHead>Shift</TableHead>
                  <TableHead>Scheduled</TableHead>
                  <TableHead>Actual</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Worked</TableHead>
                  <TableHead>OT</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                      Nothing to review in this range.
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell><Checkbox checked={selected.has(r.id)} onCheckedChange={() => toggle(r.id)} /></TableCell>
                      <TableCell className="whitespace-nowrap">
                        {format(new Date(r.shift_date + "T00:00:00"), "dd MMM yyyy")}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{r.employee?.full_name}</div>
                        <div className="text-xs text-muted-foreground">{r.employee?.staff_id}</div>
                      </TableCell>
                      <TableCell>{r.shift_type ?? "—"}</TableCell>
                      <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                        {fmtTime(r.scheduled_start)} – {fmtTime(r.scheduled_end)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm">
                        {fmtTime(r.actual_start)} – {fmtTime(r.actual_end)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={r.anomaly_code ? "destructive" : "outline"}>
                          {r.anomaly_code ?? r.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{fmtMins(r.worked_minutes)}</TableCell>
                      <TableCell className="font-medium">
                        {r.overtime_minutes > 0 ? fmtMins(r.overtime_minutes) : "—"}
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
