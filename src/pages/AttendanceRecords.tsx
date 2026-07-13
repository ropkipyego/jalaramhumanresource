import { useEffect, useMemo, useState } from "react";
import { format, subDays } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useRole } from "@/hooks/useRole";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Calendar, Loader2, RefreshCw, Search } from "lucide-react";

interface DailyRow {
  id: string;
  employee_id: string;
  work_date: string;
  expected_shift_code: string | null;
  first_in: string | null;
  last_out: string | null;
  worked_minutes: number;
  late_minutes: number;
  ot_minutes: number;
  status: string;
  approval_status: string;
  employee?: { full_name: string; staff_id: string };
}

const statusColor: Record<string, string> = {
  PRESENT: "default", LATE: "secondary", PARTIAL: "secondary",
  ABSENT: "destructive", ON_LEAVE: "outline", OFF: "outline", HOLIDAY: "outline",
};

export default function AttendanceRecords() {
  const { hasRole } = useRole();
  const canManage = hasRole("ADMIN");

  const [rows, setRows] = useState<DailyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [computing, setComputing] = useState(false);
  const [from, setFrom] = useState(format(subDays(new Date(), 14), "yyyy-MM-dd"));
  const [to, setTo] = useState(format(new Date(), "yyyy-MM-dd"));
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");

  const load = async () => {
    setLoading(true);
    let q = supabase
      .from("attendance_daily")
      .select("*, employee:profiles(full_name, staff_id)")
      .gte("work_date", from)
      .lte("work_date", to)
      .order("work_date", { ascending: false })
      .limit(500);
    const { data, error } = await q;
    if (error) toast.error(error.message);
    setRows((data as DailyRow[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [from, to]);

  const recompute = async () => {
    setComputing(true);
    const { data, error } = await supabase.rpc("compute_attendance_range", {
      _from: from, _to: to, _employee_id: null,
    });
    setComputing(false);
    if (error) toast.error(error.message);
    else {
      toast.success(`Computed ${(data as any)?.computed_days ?? 0} daily records`);
      load();
    }
  };

  const approve = async (id: string) => {
    const { error } = await supabase.from("attendance_daily").update({
      approval_status: "APPROVED", approved_at: new Date().toISOString(),
    }).eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Approved"); load(); }
  };

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (!s) return true;
      return (
        r.employee?.full_name?.toLowerCase().includes(s) ||
        r.employee?.staff_id?.toLowerCase().includes(s)
      );
    });
  }, [rows, search, statusFilter]);

  const fmtTime = (ts: string | null) => ts ? format(new Date(ts), "HH:mm") : "—";
  const fmtMins = (m: number) => m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Daily Attendance</h1>
          <p className="text-muted-foreground">Computed from biometric punches and rota expectations.</p>
        </div>
        {canManage && (
          <Button variant="outline" onClick={recompute} disabled={computing}>
            {computing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Recompute Range
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap gap-3 items-end">
            <div><label className="text-xs text-muted-foreground">From</label>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" /></div>
            <div><label className="text-xs text-muted-foreground">To</label>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" /></div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {["PRESENT", "LATE", "ABSENT", "PARTIAL", "ON_LEAVE", "OFF"].map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search staff…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
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
                  <TableHead>Date</TableHead>
                  <TableHead>Employee</TableHead>
                  <TableHead>Shift</TableHead>
                  <TableHead>In</TableHead>
                  <TableHead>Out</TableHead>
                  <TableHead>Worked</TableHead>
                  <TableHead>Late</TableHead>
                  <TableHead>OT</TableHead>
                  <TableHead>Status</TableHead>
                  {canManage && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                    No records — import biometric data or run Recompute.
                  </TableCell></TableRow>
                ) : filtered.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="whitespace-nowrap">{format(new Date(r.work_date + "T00:00:00"), "dd MMM yyyy")}</TableCell>
                    <TableCell>
                      <div className="font-medium">{r.employee?.full_name}</div>
                      <div className="text-xs text-muted-foreground">{r.employee?.staff_id}</div>
                    </TableCell>
                    <TableCell>{r.expected_shift_code ?? "—"}</TableCell>
                    <TableCell>{fmtTime(r.first_in)}</TableCell>
                    <TableCell>{fmtTime(r.last_out)}</TableCell>
                    <TableCell>{fmtMins(r.worked_minutes)}</TableCell>
                    <TableCell>{r.late_minutes > 0 ? <span className="text-destructive">{r.late_minutes}m</span> : "—"}</TableCell>
                    <TableCell>{r.ot_minutes > 0 ? `${r.ot_minutes}m` : "—"}</TableCell>
                    <TableCell>
                      <Badge variant={(statusColor[r.status] as "default") || "outline"}>{r.status}</Badge>
                    </TableCell>
                    {canManage && (
                      <TableCell className="text-right">
                        {r.approval_status === "PENDING" && r.status !== "OFF" && r.status !== "ON_LEAVE" && (
                          <Button size="sm" variant="ghost" onClick={() => approve(r.id)}>Approve</Button>
                        )}
                        {r.approval_status === "APPROVED" && <Badge variant="outline" className="text-xs">Approved</Badge>}
                      </TableCell>
                    )}
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
