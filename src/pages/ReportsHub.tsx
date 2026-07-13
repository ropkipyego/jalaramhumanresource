import { useState } from "react";
import { Navigate } from "react-router-dom";
import { addDays, format, startOfYear } from "date-fns";
import { useRole } from "@/hooks/useRole";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Download, FileSpreadsheet, Loader2, Users, CalendarCheck, Palmtree, Wallet, ShieldAlert,
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
  const { canViewPayroll } = useRole();
  const [busy, setBusy] = useState<string | null>(null);

  if (!canViewPayroll) return <Navigate to="/dashboard" replace />;

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    try { await fn(); }
    catch (e: any) { toast.error(e?.message || "Export failed"); }
    finally { setBusy(null); }
  };

  const exportEmployees = () => run("employees", async () => {
    const { data, error } = await supabase
      .from("profiles")
      .select("staff_id, full_name, email, designation, employment_type, hr_status, kra_pin, date_joined, basic_salary")
      .eq("is_active", true)
      .order("full_name");
    if (error) throw error;
    downloadCsv("employees-active.csv",
      ["Staff ID","Name","Email","Designation","Type","Status","KRA PIN","Date Joined","Basic Salary"],
      (data || []).map((r: any) => [r.staff_id, r.full_name, r.email, r.designation, r.employment_type, r.hr_status, r.kra_pin, r.date_joined, r.basic_salary])
    );
    toast.success("Employees exported");
  });

  const exportAttendance = () => run("attendance", async () => {
    const from = format(addDays(new Date(), -30), "yyyy-MM-dd");
    const { data, error } = await supabase
      .from("attendance_daily")
      .select("work_date, status, worked_minutes, late_minutes, ot_minutes, employee:profiles!attendance_daily_employee_id_fkey(full_name, staff_id)")
      .gte("work_date", from)
      .order("work_date", { ascending: false });
    if (error) throw error;
    downloadCsv("attendance-last-30d.csv",
      ["Date","Staff ID","Name","Status","Worked mins","Late mins","OT mins"],
      (data || []).map((r: any) => [r.work_date, r.employee?.staff_id, r.employee?.full_name, r.status, r.worked_minutes, r.late_minutes, r.ot_minutes])
    );
    toast.success("Attendance exported");
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
    const { data: period, error: pe } = await supabase
      .from("payroll_periods")
      .select("id, period_year, period_month, status")
      .order("period_year", { ascending: false })
      .order("period_month", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (pe) throw pe;
    if (!period) { toast.error("No payroll period found"); return; }
    const { data, error } = await supabase
      .from("payroll_runs")
      .select("gross_earnings, total_deductions, net_pay, is_included, employee:profiles!payroll_runs_employee_id_fkey(full_name, staff_id)")
      .eq("period_id", period.id);
    if (error) throw error;
    const label = `${MONTHS[period.period_month - 1]}-${period.period_year}`;
    downloadCsv(`payroll-runs-${label}.csv`,
      ["Staff ID","Name","Gross","Deductions","Net","Included"],
      (data || []).map((r: any) => [r.employee?.staff_id, r.employee?.full_name, r.gross_earnings, r.total_deductions, r.net_pay, r.is_included])
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
    { key: "employees", title: "Active Employees", desc: "All active profiles", icon: Users, fn: exportEmployees },
    { key: "attendance", title: "Attendance (30 days)", desc: "Daily attendance records", icon: CalendarCheck, fn: exportAttendance },
    { key: "leave", title: "Leave (this year)", desc: "Approved leave requests", icon: Palmtree, fn: exportLeave },
    { key: "payroll", title: "Payroll (latest period)", desc: "Runs for the latest period", icon: Wallet, fn: exportPayroll },
    { key: "licenses", title: "Licenses expiring", desc: "Expired or within 90 days", icon: ShieldAlert, fn: exportLicenses },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Reports Hub</h1>
        <p className="text-muted-foreground">Export CSV reports for HR and Finance.</p>
      </div>

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
            Exports download as CSV files you can open in Excel or Google Sheets. Payroll export uses the most recent payroll period.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
