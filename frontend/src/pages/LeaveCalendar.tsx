import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, parseISO, isWithinInterval } from "date-fns";
import { useRole } from "@/hooks/useRole";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { CalendarDays, Loader2 } from "lucide-react";

interface LeaveRow {
  id: string;
  start_date: string;
  end_date: string;
  leave_type: string;
  department_id: string;
  employee?: { full_name: string; staff_id: string };
  department?: { name: string };
}
interface Dept { id: string; name: string }

export default function LeaveCalendar() {
  const { hasRole } = useRole();
  const canAccess = hasRole("HEAD");
  const [month, setMonth] = useState(format(new Date(), "yyyy-MM"));
  const [deptId, setDeptId] = useState("all");
  const [depts, setDepts] = useState<Dept[]>([]);
  const [rows, setRows] = useState<LeaveRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!canAccess) return;
    supabase.from("departments").select("id, name").eq("is_active", true).order("name")
      .then(({ data }) => setDepts((data as Dept[]) || []));
  }, [canAccess]);

  useEffect(() => {
    if (!canAccess) return;
    (async () => {
      setLoading(true);
      const start = `${month}-01`;
      const end = format(endOfMonth(parseISO(start)), "yyyy-MM-dd");
      let q = supabase
        .from("leave_requests")
        .select("id, start_date, end_date, leave_type, department_id, employee:profiles!leave_requests_employee_id_fkey(full_name, staff_id), department:departments(name)")
        .eq("status", "approved")
        .lte("start_date", end)
        .gte("end_date", start);
      if (deptId !== "all") q = q.eq("department_id", deptId);
      const { data, error } = await q;
      if (error) toast.error(error.message);
      setRows((data as LeaveRow[]) || []);
      setLoading(false);
    })();
  }, [canAccess, month, deptId]);

  const days = useMemo(() => {
    const start = startOfMonth(parseISO(`${month}-01`));
    return eachDayOfInterval({ start, end: endOfMonth(start) });
  }, [month]);

  const byDay = useMemo(() => {
    const map = new Map<string, LeaveRow[]>();
    for (const d of days) {
      const key = format(d, "yyyy-MM-dd");
      map.set(key, rows.filter((r) =>
        isWithinInterval(d, { start: parseISO(r.start_date), end: parseISO(r.end_date) })
      ));
    }
    return map;
  }, [days, rows]);

  if (!canAccess) return <Navigate to="/dashboard" replace />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Leave Calendar</h1>
        <p className="text-muted-foreground">Approved leave across the organisation.</p>
      </div>

      <div className="flex flex-wrap gap-4 items-end">
        <div>
          <Label>Month</Label>
          <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-44" />
        </div>
        <div>
          <Label>Department</Label>
          <Select value={deptId} onValueChange={setDeptId}>
            <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All departments</SelectItem>
              {depts.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><CalendarDays className="h-5 w-5" />{format(parseISO(`${month}-01`), "MMMM yyyy")}</CardTitle>
          <CardDescription>{rows.length} approved leave request{rows.length !== 1 ? "s" : ""}</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin" /></div>
          ) : (
            <div className="space-y-3 max-h-[70vh] overflow-auto">
              {days.map((d) => {
                const key = format(d, "yyyy-MM-dd");
                const list = byDay.get(key) || [];
                if (list.length === 0) return null;
                return (
                  <div key={key} className="border-b pb-3 last:border-0">
                    <div className="font-medium text-sm mb-1">{format(d, "EEE dd MMM")}</div>
                    <div className="flex flex-wrap gap-2">
                      {list.map((r) => (
                        <Badge key={r.id} variant="secondary" className="font-normal">
                          {r.employee?.full_name} · {r.leave_type}
                          {r.department?.name ? ` · ${r.department.name}` : ""}
                        </Badge>
                      ))}
                    </div>
                  </div>
                );
              })}
              {rows.length === 0 && (
                <p className="text-center text-muted-foreground py-8">No approved leave this month.</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
