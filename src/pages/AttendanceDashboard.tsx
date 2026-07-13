import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useRole } from "@/hooks/useRole";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, Clock, AlertTriangle, Moon, CalendarDays, Coffee, Upload, FileText } from "lucide-react";

export default function AttendanceDashboard() {
  const { hasRole } = useRole();
  const canManage = hasRole("ADMIN");
  const today = format(new Date(), "yyyy-MM-dd");

  const [stats, setStats] = useState({
    templates: 0, holidays: 0, activeStaff: 0,
    presentToday: 0, onLeaveToday: 0, absentToday: 0,
    openExceptions: 0, pendingApproval: 0,
  });

  useEffect(() => {
    (async () => {
      const [
        t, h, s, present, onLeave, absent, exceptions, pending,
      ] = await Promise.all([
        supabase.from("shift_templates").select("id", { count: "exact", head: true }).eq("is_active", true),
        supabase.from("public_holidays").select("id", { count: "exact", head: true }).gte("holiday_date", today),
        supabase.from("profiles").select("id", { count: "exact", head: true }).eq("hr_status", "ACTIVE"),
        supabase.from("attendance_daily").select("id", { count: "exact", head: true })
          .eq("work_date", today).in("status", ["PRESENT", "LATE", "PARTIAL"]),
        supabase.from("attendance_daily").select("id", { count: "exact", head: true })
          .eq("work_date", today).eq("status", "ON_LEAVE"),
        supabase.from("attendance_daily").select("id", { count: "exact", head: true })
          .eq("work_date", today).eq("status", "ABSENT"),
        supabase.from("attendance_exceptions").select("id", { count: "exact", head: true }).eq("resolved", false),
        supabase.from("attendance_daily").select("id", { count: "exact", head: true })
          .eq("approval_status", "PENDING").neq("status", "OFF"),
      ]);
      setStats({
        templates: t.count ?? 0,
        holidays: h.count ?? 0,
        activeStaff: s.count ?? 0,
        presentToday: present.count ?? 0,
        onLeaveToday: onLeave.count ?? 0,
        absentToday: absent.count ?? 0,
        openExceptions: exceptions.count ?? 0,
        pendingApproval: pending.count ?? 0,
      });
    })();
  }, [today]);

  const kpis = [
    { label: "Present Today", value: stats.presentToday, icon: Coffee, href: "/attendance/records" },
    { label: "On Leave", value: stats.onLeaveToday, icon: CalendarDays, href: "/attendance/records" },
    { label: "Absent Today", value: stats.absentToday, icon: AlertTriangle, href: "/attendance/exceptions", alert: stats.absentToday > 0 },
    { label: "Open Exceptions", value: stats.openExceptions, icon: AlertTriangle, href: "/attendance/exceptions", alert: stats.openExceptions > 0 },
    { label: "Pending Approval", value: stats.pendingApproval, icon: Clock, href: "/attendance/records" },
    { label: "Active Staff", value: stats.activeStaff, icon: Users, href: "/staff" },
    { label: "Shift Templates", value: stats.templates, icon: Moon, href: "/attendance/shift-templates" },
    { label: "Upcoming Holidays", value: stats.holidays, icon: CalendarDays, href: "/attendance/holidays" },
  ];

  const quickLinks = [
    { title: "Biometric Import", desc: "Upload ZKTeco / device Excel", href: "/attendance/import", icon: Upload, admin: true },
    { title: "Daily Records", desc: "View & approve attendance", href: "/attendance/records", icon: FileText },
    { title: "Exceptions", desc: "Late, absent, OT queue", href: "/attendance/exceptions", icon: AlertTriangle },
    { title: "My Attendance", desc: "Clock in/out & self-view", href: "/attendance/my", icon: Clock },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Time & Attendance</h1>
        <p className="text-muted-foreground text-sm">
          Biometric import, attendance engine, and payroll bridge — live.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {kpis.map((k) => (
          <Card key={k.label} className={k.alert ? "border-destructive/50" : ""}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{k.label}</CardTitle>
              <k.icon className={`h-4 w-4 ${k.alert ? "text-destructive" : "text-muted-foreground"}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{k.value}</div>
              <Button asChild variant="link" className="px-0 h-auto text-xs">
                <Link to={k.href}>View</Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {quickLinks.filter((l) => !l.admin || canManage).map((l) => (
          <Card key={l.href} className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-2">
              <l.icon className="h-5 w-5 text-primary mb-2" />
              <CardTitle className="text-base">{l.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground mb-3">{l.desc}</p>
              <Button asChild size="sm" variant="outline"><Link to={l.href}>Open</Link></Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
