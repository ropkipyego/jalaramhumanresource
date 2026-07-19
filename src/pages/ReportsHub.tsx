import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { addDays, format, startOfMonth, endOfMonth, startOfYear } from "date-fns";
import { useRole } from "@/hooks/useRole";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Download, FileSpreadsheet, Loader2, Users, CalendarCheck, Palmtree, Wallet, ShieldAlert,
  Timer, UserX, Moon, AlertTriangle,
} from "lucide-react";

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function downloadCsv(filename: string, header: string[], rows: (string | number | null | undefined)[][]) {
  const csv = [header, ...rows]
    .map((row) => row.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ReportsHub() {
  const { canViewPayroll, hasRole } = useRole();
  const [busy, setBusy] = useState<string | null>(null);
  const [from, setFrom] = useState(format(startOfMonth(new Date()), "yyyy-MM-dd"));
  const [to, setTo] = useState(format(endOfMonth(new Date()), "yyyy-MM-dd"));
  const [periods, setPeriods] = useState<{ id: string; period_year: number; period_month: number; status: string }[]>([]);
  const [periodId, setPeriodId] = useState("");

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("payroll_periods")
        .select("id, period_year, period_month, status")
        .order("period_year", { ascending: false })
        .order("period_month", { ascending: false })
        .limit(24);
      const list = (data as any[]) || [];
      setPeriods(list);
      if (list[0]) setPeriodId(list[0].id);
    })();
  }, []);

  if (!canViewPayroll && !hasRole("HEAD") && !hasRole("ADMIN")) {
    return <Navigate to="/dashboard" replace />;
  }

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    try { await fn(); }
    catch (e: any) { toast.error(e?.message || "Export failed"); }
    finally { setBusy(null); }
  };

  const exportEmployees = () => run("employees", async () => {
    const { data, error } = await supabase
      .from("profiles")
      .select("staff_id, full_name, email, designation, employment_type, hr_status, kra_pin, nssf_number, shif_number, bank_name, bank_account, date_joined, basic_salary")
      .eq("is_active", true)
      .order("full_name");
    if (error) throw error;
    downloadCsv("employees-active.csv",
      ["Staff ID","Name","Email","Designation","Type","Status","KRA","NSSF","SHIF","Bank","Account","Date Joined","Basic"],
      (data || []).map((r: any) => [r.staff_id, r.full_name, r.email, r.designation, r.employment_type, r.hr_status, r.kra_pin, r.nssf_number, r.shif_number, r.bank_name, r.bank_account, r.date_joined, r.basic_salary])
    );
    toast.success("Employees exported");
  });

  const exportAttendance = () => run("attendance", async () => {
    const { data, error } = await supabase
      .from("attendance_daily")
      .select("work_date, status, approval_status, worked_minutes, late_minutes, ot_minutes, night_minutes, holiday_minutes, employee:profiles!attendance_daily_employee_id_fkey(full_name, staff_id)")
      .gte("work_date", from)
      .lte("work_date", to)
      .order("work_date", { ascending: false });
    if (error) throw error;
    downloadCsv(`attendance-${from}-to-${to}.csv`,
      ["Date","Staff ID","Name","Status","Approval","Worked","Late","OT","Night","Holiday"],
      (data || []).map((r: any) => [r.work_date, r.employee?.staff_id, r.employee?.full_name, r.status, r.approval_status, r.worked_minutes, r.late_minutes, r.ot_minutes, r.night_minutes, r.holiday_minutes])
    );
    toast.success("Attendance exported");
  });

  const exportOt = () => run("ot", async () => {
    const { data, error } = await supabase
      .from("attendance_daily")
      .select("work_date, ot_minutes, approval_status, status, employee:profiles!attendance_daily_employee_id_fkey(full_name, staff_id)")
      .gte("work_date", from)
      .lte("work_date", to)
      .gt("ot_minutes", 0)
      .order("work_date", { ascending: false });
    if (error) throw error;
    downloadCsv(`ot-summary-${from}-to-${to}.csv`,
      ["Date","Staff ID","Name","OT mins","Approval","Day status"],
      (data || []).map((r: any) => [r.work_date, r.employee?.staff_id, r.employee?.full_name, r.ot_minutes, r.approval_status, r.status])
    );
    toast.success("OT summary exported");
  });

  const exportAbsenteeism = () => run("absent", async () => {
    const { data, error } = await supabase
      .from("attendance_daily")
      .select("work_date, status, employee:profiles!attendance_daily_employee_id_fkey(full_name, staff_id)")
      .gte("work_date", from)
      .lte("work_date", to)
      .in("status", ["ABSENT", "PARTIAL", "LATE"])
      .order("work_date", { ascending: false });
    if (error) throw error;
    downloadCsv(`absenteeism-${from}-to-${to}.csv`,
      ["Date","Staff ID","Name","Status"],
      (data || []).map((r: any) => [r.work_date, r.employee?.staff_id, r.employee?.full_name, r.status])
    );
    toast.success("Absenteeism exported");
  });

  const exportNightPh = () => run("night", async () => {
    const { data, error } = await supabase
      .from("attendance_daily")
      .select("work_date, night_minutes, holiday_minutes, weekend_minutes, status, approval_status, employee:profiles!attendance_daily_employee_id_fkey(full_name, staff_id)")
      .gte("work_date", from)
      .lte("work_date", to)
      .or("night_minutes.gt.0,holiday_minutes.gt.0,weekend_minutes.gt.0")
      .order("work_date", { ascending: false });
    if (error) throw error;
    downloadCsv(`night-ph-weekend-${from}-to-${to}.csv`,
      ["Date","Staff ID","Name","Night mins","Holiday mins","Weekend mins","Status","Approval"],
      (data || []).map((r: any) => [r.work_date, r.employee?.staff_id, r.employee?.full_name, r.night_minutes, r.holiday_minutes, r.weekend_minutes, r.status, r.approval_status])
    );
    toast.success("Night/PH/weekend exported");
  });

  const exportExceptions = () => run("exceptions", async () => {
    const { data, error } = await supabase
      .from("attendance_exceptions")
      .select("work_date, exception_type, severity, description, resolved, employee:profiles!attendance_exceptions_employee_id_fkey(full_name, staff_id)")
      .gte("work_date", from)
      .lte("work_date", to)
      .order("work_date", { ascending: false });
    if (error) throw error;
    downloadCsv(`exceptions-${from}-to-${to}.csv`,
      ["Date","Staff ID","Name","Type","Severity","Description","Resolved"],
      (data || []).map((r: any) => [r.work_date, r.employee?.staff_id, r.employee?.full_name, r.exception_type, r.severity, r.description, r.resolved ? "YES" : "NO"])
    );
    toast.success("Exceptions exported");
  });

  const exportLeave = () => run("leave", async () => {
    const yearStart = format(startOfYear(new Date()), "yyyy-MM-dd");
    const { data, error } = await supabase
      .from("leave_requests")
      .select("leave_type, start_date, end_date, status, employee:profiles!leave_requests_employee_id_fkey(full_name, staff_id)")
      .eq("status", "approved")
      .gte("start_date", yearStart)
      .order("start_date");
    if (error) throw error;
    downloadCsv(`leave-approved-${new Date().getFullYear()}.csv`,
      ["Staff ID","Name","Type","Start","End","Status"],
      (data || []).map((r: any) => [r.employee?.staff_id, r.employee?.full_name, r.leave_type, r.start_date, r.end_date, r.status])
    );
    toast.success("Leave exported");
  });

  const exportPayroll = () => run("payroll", async () => {
    const id = periodId || periods[0]?.id;
    if (!id) { toast.error("No payroll period found"); return; }
    const period = periods.find((p) => p.id === id) || periods[0];
    const { data, error } = await supabase
      .from("payroll_runs")
      .select("gross_earnings, total_deductions, net_pay, is_included, employee:profiles!payroll_runs_employee_id_fkey(full_name, staff_id, kra_pin, bank_name, bank_account)")
      .eq("period_id", id);
    if (error) throw error;
    const label = `${MONTHS[period.period_month - 1]}-${period.period_year}`;
    downloadCsv(`payroll-runs-${label}.csv`,
      ["Staff ID","Name","KRA","Bank","Account","Gross","Deductions","Net","Included"],
      (data || []).map((r: any) => [r.employee?.staff_id, r.employee?.full_name, r.employee?.kra_pin, r.employee?.bank_name, r.employee?.bank_account, r.gross_earnings, r.total_deductions, r.net_pay, r.is_included])
    );
    toast.success(`Payroll for ${label} exported`);
  });

  const exportLicenses = () => run("licenses", async () => {
    const cutoff = format(addDays(new Date(), 90), "yyyy-MM-dd");
    const today = format(new Date(), "yyyy-MM-dd");
    const { data, error } = await supabase
      .from("profiles")
      .select("staff_id, full_name, practicing_license_no, license_expiry_date")
      .eq("is_active", true)
      .not("license_expiry_date", "is", null)
      .lte("license_expiry_date", cutoff)
      .order("license_expiry_date");
    if (error) throw error;
    downloadCsv("licenses-expiring.csv",
      ["Staff ID","Name","License No","Expiry","Expired"],
      (data || []).map((r: any) => [
        r.staff_id, r.full_name, r.practicing_license_no, r.license_expiry_date,
        r.license_expiry_date < today ? "YES" : "NO",
      ])
    );
    toast.success("Licenses exported");
  });

  const reports = [
    { key: "employees", title: "Active Employees", desc: "Profiles with statutory & bank fields", icon: Users, fn: exportEmployees },
    { key: "attendance", title: "Attendance range", desc: "Uses date range below", icon: CalendarCheck, fn: exportAttendance },
    { key: "ot", title: "OT summary", desc: "OT minutes in date range", icon: Timer, fn: exportOt },
    { key: "absent", title: "Absenteeism", desc: "ABSENT / PARTIAL / LATE", icon: UserX, fn: exportAbsenteeism },
    { key: "night", title: "Night / PH / Weekend", desc: "Duty premiums in range", icon: Moon, fn: exportNightPh },
    { key: "exceptions", title: "Exceptions", desc: "Open & resolved exceptions", icon: AlertTriangle, fn: exportExceptions },
    { key: "leave", title: "Leave (this year)", desc: "Approved leave requests", icon: Palmtree, fn: exportLeave },
    { key: "payroll", title: "Payroll period", desc: "Selected period runs", icon: Wallet, fn: exportPayroll },
    { key: "licenses", title: "Licenses expiring", desc: "Expired or within 90 days", icon: ShieldAlert, fn: exportLicenses },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Reports Hub</h1>
        <p className="text-muted-foreground">Month-close CSV exports for HR and Finance.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filters</CardTitle>
          <CardDescription>Used by attendance / OT / absenteeism / exceptions exports.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-4 items-end">
          <div>
            <Label>From</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" />
          </div>
          <div>
            <Label>To</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" />
          </div>
          <div>
            <Label>Payroll period</Label>
            <select
              className="flex h-10 w-56 rounded-md border border-input bg-background px-3 text-sm"
              value={periodId}
              onChange={(e) => setPeriodId(e.target.value)}
            >
              {periods.length === 0 && <option value="">No periods</option>}
              {periods.map((p) => (
                <option key={p.id} value={p.id}>
                  {MONTHS[p.period_month - 1]} {p.period_year} ({p.status})
                </option>
              ))}
            </select>
          </div>
          <Button asChild variant="outline">
            <Link to="/payroll">Open Payroll</Link>
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {reports.map((r) => (
          <Card key={r.key}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <r.icon className="h-5 w-5" />{r.title}
              </CardTitle>
              <CardDescription>{r.desc}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={r.fn} disabled={busy !== null} className="w-full">
                {busy === r.key
                  ? <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  : <Download className="h-4 w-4 mr-2" />}
                Export CSV
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><FileSpreadsheet className="h-5 w-5" />Tip</CardTitle>
          <CardDescription>
            Bank &amp; statutory filing CSVs also live on each payroll period page after Finance approval.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
