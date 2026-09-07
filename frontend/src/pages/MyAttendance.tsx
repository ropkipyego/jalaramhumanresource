import { useEffect, useState } from "react";
import { format, subDays } from "date-fns";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Clock, Loader2 } from "lucide-react";
import { ClockInOut } from "@/components/attendance/ClockInOut";

interface DailyRow {
  work_date: string;
  first_in: string | null;
  last_out: string | null;
  worked_minutes: number;
  late_minutes: number;
  ot_minutes: number;
  status: string;
  expected_shift_code: string | null;
}

export default function MyAttendance() {
  const { user } = useAuth();
  const [rows, setRows] = useState<DailyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState({ present: 0, late: 0, absent: 0, ot: 0 });

  useEffect(() => {
    if (!user) return;
    (async () => {
      const from = format(subDays(new Date(), 30), "yyyy-MM-dd");
      const { data } = await supabase
        .from("attendance_daily")
        .select("work_date, first_in, last_out, worked_minutes, late_minutes, ot_minutes, status, expected_shift_code")
        .eq("employee_id", user.id)
        .gte("work_date", from)
        .order("work_date", { ascending: false });
      const list = (data as DailyRow[]) || [];
      setRows(list);
      setSummary({
        present: list.filter((r) => r.status === "PRESENT").length,
        late: list.filter((r) => r.status === "LATE").length,
        absent: list.filter((r) => r.status === "ABSENT").length,
        ot: list.reduce((s, r) => s + r.ot_minutes, 0),
      });
      setLoading(false);
    })();
  }, [user]);

  const fmtTime = (ts: string | null) => ts ? format(new Date(ts), "HH:mm") : "—";

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-3xl font-bold">My Attendance</h1>
        <p className="text-muted-foreground">Your clock records and computed daily attendance (last 30 days).</p>
      </div>

      <ClockInOut onPunch={() => window.location.reload()} />

      <div className="grid gap-4 md:grid-cols-4">
        {[
          { label: "Present", value: summary.present },
          { label: "Late", value: summary.late },
          { label: "Absent", value: summary.absent },
          { label: "OT (min)", value: summary.ot },
        ].map((k) => (
          <Card key={k.label}>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">{k.label}</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-bold">{k.value}</div></CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Clock className="h-5 w-5" />Daily Log</CardTitle>
          <CardDescription>Computed from biometric device or web clock punches.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin" /></div>
          ) : rows.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No attendance records yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Shift</TableHead>
                  <TableHead>In</TableHead>
                  <TableHead>Out</TableHead>
                  <TableHead>Worked</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.work_date}>
                    <TableCell>{format(new Date(r.work_date + "T00:00:00"), "EEE, dd MMM")}</TableCell>
                    <TableCell>{r.expected_shift_code ?? "—"}</TableCell>
                    <TableCell>{fmtTime(r.first_in)}</TableCell>
                    <TableCell>{fmtTime(r.last_out)}</TableCell>
                    <TableCell>{r.worked_minutes > 0 ? `${Math.floor(r.worked_minutes / 60)}h ${r.worked_minutes % 60}m` : "—"}</TableCell>
                    <TableCell><Badge variant="outline">{r.status}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
