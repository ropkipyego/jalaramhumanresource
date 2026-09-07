import { useEffect, useState } from "react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { Navigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useRole } from "@/hooks/useRole";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { CalendarRange, Cpu, Loader2, PlayCircle, RefreshCw, Timer, AlertTriangle } from "lucide-react";

type RunRow = {
  id: string;
  period_start: string;
  period_end: string;
  engine_version: string;
  shift_count: number;
  record_count: number;
  anomaly_count: number;
  status: string;
  notes: string | null;
  created_at: string;
};

type Summary = {
  shifts: number;
  punches: number;
  records: number;
  anomalies: number;
  overtime_pending: number;
  skipped_corrected: number;
  by_status: Record<string, number>;
};

export default function AttendanceProcessing() {
  const { hasRole } = useRole();
  const canAccess = hasRole("ADMIN");

  const [from, setFrom] = useState(format(startOfMonth(new Date()), "yyyy-MM-dd"));
  const [to, setTo] = useState(format(endOfMonth(new Date()), "yyyy-MM-dd"));
  const [building, setBuilding] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [runs, setRuns] = useState<RunRow[]>([]);

  const loadRuns = async () => {
    const { data } = await supabase
      .from("attendance_processing_runs" as never)
      .select("*")
      .order("created_at", { ascending: false })
      .limit(10);
    setRuns((data as unknown as RunRow[]) || []);
  };

  useEffect(() => {
    if (canAccess) loadRuns();
  }, [canAccess]);

  if (!canAccess) return <Navigate to="/attendance" replace />;

  const buildShifts = async () => {
    setBuilding(true);
    const { data, error } = await supabase.rpc("sync_shift_instances_from_rota" as never, {
      _from: from,
      _to: to,
    } as never);
    setBuilding(false);
    if (error) return toast.error(error.message);
    toast.success(`Built ${(data as { shifts?: number })?.shifts ?? 0} scheduled shift(s) from the published rota`);
  };

  const runEngine = async () => {
    setProcessing(true);
    setSummary(null);
    const { data, error } = await supabase.functions.invoke("process-attendance", {
      body: { from, to },
    });
    setProcessing(false);
    if (error) return toast.error(error.message);
    if ((data as { error?: string })?.error) return toast.error((data as { error: string }).error);
    setSummary(data as Summary);
    toast.success(`Processed ${(data as Summary).records} attendance record(s)`);
    loadRuns();
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold">Attendance Processing</h1>
        <p className="text-muted-foreground">
          Compare biometric punches against the published rota and produce the attendance and overtime results.
        </p>
      </div>

      <Alert>
        <Cpu className="h-4 w-4" />
        <AlertTitle>How a month is closed</AlertTitle>
        <AlertDescription>
          1. Import the device file in <Link to="/attendance/import" className="underline">Biometric Import</Link> ·
          2. Build the scheduled shifts from the published rota ·
          3. Run the engine ·
          4. Clear anomalies and decide overtime in{" "}
          <Link to="/attendance/overtime" className="underline">OT Approvals</Link> before the payroll lock.
          Re-running is safe: results are recalculated, but manual corrections and existing overtime decisions are kept.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><CalendarRange className="h-5 w-5" />Period</CardTitle>
          <CardDescription>Night shifts are counted on the day they start.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div>
            <label className="text-xs text-muted-foreground">From</label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-44" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">To</label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-44" />
          </div>
          <Button variant="outline" onClick={buildShifts} disabled={building || processing}>
            {building ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Build shifts from rota
          </Button>
          <Button onClick={runEngine} disabled={processing || building}>
            {processing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlayCircle className="mr-2 h-4 w-4" />}
            Run attendance engine
          </Button>
        </CardContent>
      </Card>

      {summary && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 animate-fade-in">
          <StatCard label="Scheduled shifts" value={summary.shifts} />
          <StatCard label="Punches read" value={summary.punches} />
          <StatCard label="Results written" value={summary.records} />
          <StatCard label="Anomalies" value={summary.anomalies} tone="warning" icon={<AlertTriangle className="h-4 w-4" />} />
          <StatCard label="OT awaiting approval" value={summary.overtime_pending} icon={<Timer className="h-4 w-4" />} />
          <StatCard label="Kept as corrected" value={summary.skipped_corrected} />
          <Card className="sm:col-span-2">
            <CardHeader className="pb-2"><CardTitle className="text-sm">Breakdown by status</CardTitle></CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {Object.entries(summary.by_status).map(([k, v]) => (
                <Badge key={k} variant="outline">{k}: {v}</Badge>
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Recent processing runs</CardTitle>
          <CardDescription>Every calculation is logged for audit.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Run at</TableHead>
                <TableHead>Period</TableHead>
                <TableHead>Engine</TableHead>
                <TableHead>Shifts</TableHead>
                <TableHead>Records</TableHead>
                <TableHead>Anomalies</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {runs.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No runs yet.</TableCell></TableRow>
              ) : runs.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="whitespace-nowrap">{format(new Date(r.created_at), "dd MMM yyyy HH:mm")}</TableCell>
                  <TableCell className="whitespace-nowrap">{r.period_start} → {r.period_end}</TableCell>
                  <TableCell>{r.engine_version}</TableCell>
                  <TableCell>{r.shift_count}</TableCell>
                  <TableCell>{r.record_count}</TableCell>
                  <TableCell>{r.anomaly_count}</TableCell>
                  <TableCell>
                    <Badge variant={r.status === "COMPLETED" ? "outline" : "destructive"}>{r.status}</Badge>
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

function StatCard({
  label, value, tone, icon,
}: { label: string; value: number; tone?: "warning"; icon?: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          {icon}{label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className={`text-3xl font-bold ${tone === "warning" && value > 0 ? "text-warning" : ""}`}>{value}</div>
      </CardContent>
    </Card>
  );
}
