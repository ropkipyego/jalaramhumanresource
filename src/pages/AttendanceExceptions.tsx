import { useEffect, useState } from "react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useRole } from "@/hooks/useRole";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";

interface ExceptionRow {
  id: string;
  work_date: string;
  exception_type: string;
  severity: string;
  description: string;
  resolved: boolean;
  employee?: { full_name: string; staff_id: string };
}

export default function AttendanceExceptions() {
  const { hasRole } = useRole();
  const canManage = hasRole("HEAD");

  const [rows, setRows] = useState<ExceptionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showResolved, setShowResolved] = useState(false);

  const load = async () => {
    setLoading(true);
    let q = supabase
      .from("attendance_exceptions")
      .select("*, employee:profiles(full_name, staff_id)")
      .order("work_date", { ascending: false })
      .limit(200);
    if (!showResolved) q = q.eq("resolved", false);
    const { data, error } = await q;
    if (error) toast.error(error.message);
    setRows((data as ExceptionRow[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [showResolved]);

  const resolve = async (id: string) => {
    const { error } = await supabase.from("attendance_exceptions").update({
      resolved: true, resolved_at: new Date().toISOString(),
    }).eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Resolved"); load(); }
  };

  const sevColor = (s: string) => s === "blocker" ? "destructive" : s === "warning" ? "secondary" : "outline";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Attendance Exceptions</h1>
          <p className="text-muted-foreground">Late arrivals, absences, missing punches, and pending overtime.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setShowResolved(!showResolved)}>
          {showResolved ? "Hide resolved" : "Show resolved"}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            {rows.filter((r) => !r.resolved).length} open exception(s)
          </CardTitle>
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
                  <TableHead>Type</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Status</TableHead>
                  {canManage && <TableHead className="text-right">Action</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No exceptions.</TableCell></TableRow>
                ) : rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{format(new Date(r.work_date + "T00:00:00"), "dd MMM yyyy")}</TableCell>
                    <TableCell>
                      <div className="font-medium">{r.employee?.full_name}</div>
                      <div className="text-xs text-muted-foreground">{r.employee?.staff_id}</div>
                    </TableCell>
                    <TableCell><Badge variant={sevColor(r.severity) as "destructive"}>{r.exception_type}</Badge></TableCell>
                    <TableCell className="text-sm">{r.description}</TableCell>
                    <TableCell>
                      {r.resolved
                        ? <Badge variant="outline"><CheckCircle2 className="h-3 w-3 mr-1 inline" />Resolved</Badge>
                        : <Badge variant="secondary">Open</Badge>}
                    </TableCell>
                    {canManage && (
                      <TableCell className="text-right">
                        {!r.resolved && (
                          <Button size="sm" variant="ghost" onClick={() => resolve(r.id)}>Resolve</Button>
                        )}
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
