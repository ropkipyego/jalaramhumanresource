import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useRole } from "@/hooks/useRole";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Users, CalendarDays, AlertTriangle, FileWarning, Calculator,
  ClipboardList, ShieldAlert, ArrowRight, Cake,
} from "lucide-react";
import { format, addDays, parseISO } from "date-fns";

interface HrStats {
  totalEmployees: number;
  onLeaveToday: number;
  pendingLeave: number;
  contractsExpiring: number;
  licensesExpiring: number;
  payrollStatus: string | null;
  deptDistribution: { name: string; count: number }[];
  birthdaysThisMonth: number;
}

const CHART_COLORS = ["hsl(var(--primary))", "hsl(var(--info))", "hsl(var(--warning))", "hsl(var(--success))", "hsl(var(--destructive))"];

export function HrDashboard() {
  const { isAdmin, isSuperAdmin, isFinanceAdmin } = useRole();
  const showPayroll = isAdmin || isSuperAdmin || isFinanceAdmin;

  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<HrStats>({
    totalEmployees: 0, onLeaveToday: 0, pendingLeave: 0,
    contractsExpiring: 0, licensesExpiring: 0, payrollStatus: null,
    deptDistribution: [], birthdaysThisMonth: 0,
  });

  useEffect(() => {
    (async () => {
      const today = format(new Date(), "yyyy-MM-dd");
      const in30 = format(addDays(new Date(), 30), "yyyy-MM-dd");
      const in60 = format(addDays(new Date(), 60), "yyyy-MM-dd");
      const month = new Date().getMonth() + 1;

      const [
        staffRes, leaveTodayRes, pendingRes, contractsRes, licensesRes,
        payrollRes, deptStaffRes, profilesRes,
      ] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }).eq("hr_status", "ACTIVE"),
        supabase.from("leave_requests").select("id").eq("status", "approved")
          .lte("start_date", today).gte("end_date", today),
        supabase.from("leave_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("profiles").select("id", { count: "exact", head: true })
          .eq("hr_status", "ACTIVE").not("contract_end_date", "is", null)
          .lte("contract_end_date", in30).gte("contract_end_date", today),
        supabase.from("profiles").select("id", { count: "exact", head: true })
          .eq("hr_status", "ACTIVE").not("license_expiry_date", "is", null)
          .lte("license_expiry_date", in60).gte("license_expiry_date", today),
        showPayroll
          ? supabase.from("payroll_periods").select("status").order("created_at", { ascending: false }).limit(1).maybeSingle()
          : Promise.resolve({ data: null }),
        supabase.from("employee_departments").select("department_id, departments(name)").eq("is_primary", true),
        supabase.from("profiles").select("date_of_birth").eq("hr_status", "ACTIVE").not("date_of_birth", "is", null),
      ]);

      const deptMap = new Map<string, number>();
      (deptStaffRes.data ?? []).forEach((row: { departments?: { name: string } | null }) => {
        const name = row.departments?.name ?? "Unknown";
        deptMap.set(name, (deptMap.get(name) ?? 0) + 1);
      });

      const birthdays = (profilesRes.data ?? []).filter((p: { date_of_birth: string | null }) => {
        if (!p.date_of_birth) return false;
        return parseISO(p.date_of_birth).getMonth() + 1 === month;
      }).length;

      setStats({
        totalEmployees: staffRes.count ?? 0,
        onLeaveToday: leaveTodayRes.data?.length ?? 0,
        pendingLeave: pendingRes.count ?? 0,
        contractsExpiring: contractsRes.count ?? 0,
        licensesExpiring: licensesRes.count ?? 0,
        payrollStatus: (payrollRes.data as { status: string } | null)?.status ?? null,
        deptDistribution: [...deptMap.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 8),
        birthdaysThisMonth: birthdays,
      });
      setLoading(false);
    })();
  }, [showPayroll]);

  const kpis: { label: string; value: string | number; icon: React.ComponentType<{ className?: string }>; color: string }[] = [
    { label: "Total Employees", value: stats.totalEmployees, icon: Users, color: "text-primary" },
    { label: "On Leave Today", value: stats.onLeaveToday, icon: CalendarDays, color: "text-info" },
    { label: "Pending Leave", value: stats.pendingLeave, icon: ClipboardList, color: "text-warning" },
    { label: "Contracts Expiring (30d)", value: stats.contractsExpiring, icon: FileWarning, color: "text-destructive" },
    { label: "Licenses Expiring (60d)", value: stats.licensesExpiring, icon: ShieldAlert, color: "text-destructive" },
    { label: "Birthdays This Month", value: stats.birthdaysThisMonth, icon: Cake, color: "text-success" },
  ];

  if (showPayroll) {
    kpis.push({
      label: "Latest Payroll",
      value: stats.payrollStatus ?? "None",
      icon: Calculator,
      color: "text-primary",
    });
  }

  const quickLinks = [
    { title: "Staff Directory", href: "/staff", desc: "Search and manage employees" },
    { title: "Leave Admin", href: "/leave-admin", desc: `${stats.pendingLeave} pending requests` },
    { title: "Staff Compliance", href: "/staff/compliance", desc: "KRA PIN, licenses, salaries" },
    { title: "Department Rota", href: "/rota", desc: "Manage schedules" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">HR Executive Overview</h2>
        <p className="text-sm text-muted-foreground">Workforce KPIs across the organization.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4">
        {kpis.map((k) => (
          <Card key={k.label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{k.label}</CardTitle>
              <k.icon className={`h-4 w-4 ${k.color}`} />
            </CardHeader>
            <CardContent>
              {loading ? <Skeleton className="h-8 w-16" /> : (
                <div className="text-2xl font-bold capitalize">{String(k.value)}</div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Department Distribution</CardTitle>
            <CardDescription>Staff by primary department</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-48 w-full" />
            ) : stats.deptDistribution.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-16">No department data yet.</p>
            ) : (
              <div className="space-y-3">
                {(() => {
                  const max = Math.max(...stats.deptDistribution.map((d) => d.count), 1);
                  return stats.deptDistribution.map((dept, i) => (
                    <div key={dept.name} className="flex items-center gap-3 text-sm">
                      <span className="w-24 truncate text-muted-foreground" title={dept.name}>
                        {dept.name}
                      </span>
                      <div className="relative h-7 flex-1 overflow-hidden rounded-md bg-muted">
                        <div
                          className="h-full rounded-md transition-all"
                          style={{
                            width: `${(dept.count / max) * 100}%`,
                            backgroundColor: CHART_COLORS[i % CHART_COLORS.length],
                          }}
                        />
                      </div>
                      <span className="w-8 text-right font-semibold tabular-nums">{dept.count}</span>
                    </div>
                  ));
                })()}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick Links</CardTitle>
            <CardDescription>Common HR actions</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {quickLinks.map((l) => (
              <div key={l.href} className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                <div>
                  <div className="font-medium text-sm">{l.title}</div>
                  <div className="text-xs text-muted-foreground">{l.desc}</div>
                </div>
                <Button asChild variant="ghost" size="sm">
                  <Link to={l.href}><ArrowRight className="h-4 w-4" /></Link>
                </Button>
              </div>
            ))}
            {(stats.contractsExpiring > 0 || stats.licensesExpiring > 0) && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm mt-4">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                <span>
                  {stats.contractsExpiring > 0 && `${stats.contractsExpiring} contract(s) expiring soon. `}
                  {stats.licensesExpiring > 0 && `${stats.licensesExpiring} license(s) expiring soon.`}
                  {" "}Review at <Link to="/staff/compliance" className="underline font-medium">Staff Compliance</Link>.
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
