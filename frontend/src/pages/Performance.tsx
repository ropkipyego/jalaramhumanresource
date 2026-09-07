import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useRole } from "@/hooks/useRole";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2, Plus, Target } from "lucide-react";

const db = supabase as any;

interface Review {
  id: string;
  employee_id: string;
  period_type: string;
  period_label: string;
  goals: string | null;
  kpi_score: number | null;
  supervisor_comments: string | null;
  promotion_recommended: boolean;
  status: string;
  employee?: { full_name: string; staff_id: string };
}
interface StaffOpt { id: string; full_name: string; staff_id: string }

const empty = {
  employee_id: "", period_type: "QUARTERLY", period_label: "", goals: "",
  kpi_score: "", supervisor_comments: "", promotion_recommended: false, status: "DRAFT",
};

export default function Performance() {
  const { user } = useAuth();
  const { hasRole } = useRole();
  const canManage = hasRole("HEAD");
  const [rows, setRows] = useState<Review[]>([]);
  const [staff, setStaff] = useState<StaffOpt[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);

  const load = async () => {
    setLoading(true);
    let q = db.from("performance_reviews")
      .select("*, employee:profiles!performance_reviews_employee_id_fkey(full_name, staff_id)")
      .order("created_at", { ascending: false });
    if (!canManage && user) q = q.eq("employee_id", user.id);
    const { data, error } = await q;
    if (error) toast.error(error.message);
    setRows((data as Review[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    if (canManage) {
      supabase.from("profiles").select("id, full_name, staff_id").eq("is_active", true).order("full_name")
        .then(({ data }) => setStaff((data as StaffOpt[]) || []));
    }
  }, [canManage]);

  useEffect(() => { if (user) load(); }, [user, canManage]);

  const save = async () => {
    if (!form.employee_id || !form.period_label.trim()) return toast.error("Employee and period label required");
    const { error } = await db.from("performance_reviews").insert({
      employee_id: form.employee_id,
      reviewer_id: user!.id,
      period_type: form.period_type,
      period_label: form.period_label.trim(),
      goals: form.goals.trim() || null,
      kpi_score: form.kpi_score === "" ? null : Number(form.kpi_score),
      supervisor_comments: form.supervisor_comments.trim() || null,
      promotion_recommended: form.promotion_recommended,
      status: form.status,
    });
    if (error) return toast.error(error.message);
    toast.success("Review created");
    setOpen(false); setForm(empty); load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Performance Reviews</h1>
          <p className="text-muted-foreground">{canManage ? "Create and track employee reviews." : "Your performance reviews."}</p>
        </div>
        {canManage && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />New Review</Button></DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>Create Performance Review</DialogTitle></DialogHeader>
              <div className="grid gap-3 py-2">
                <div>
                  <Label>Employee</Label>
                  <Select value={form.employee_id} onValueChange={(v) => setForm({ ...form, employee_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      {staff.map((s) => <SelectItem key={s.id} value={s.id}>{s.full_name} ({s.staff_id})</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Period type</Label>
                    <Select value={form.period_type} onValueChange={(v) => setForm({ ...form, period_type: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="QUARTERLY">Quarterly</SelectItem>
                        <SelectItem value="ANNUAL">Annual</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div><Label>Period label</Label><Input value={form.period_label} onChange={(e) => setForm({ ...form, period_label: e.target.value })} placeholder="Q1 2026" /></div>
                </div>
                <div><Label>Goals</Label><Textarea value={form.goals} onChange={(e) => setForm({ ...form, goals: e.target.value })} /></div>
                <div><Label>KPI score</Label><Input type="number" min={0} max={100} value={form.kpi_score} onChange={(e) => setForm({ ...form, kpi_score: e.target.value })} /></div>
                <div><Label>Supervisor comments</Label><Textarea value={form.supervisor_comments} onChange={(e) => setForm({ ...form, supervisor_comments: e.target.value })} /></div>
                <div className="flex items-center gap-2">
                  <Switch checked={form.promotion_recommended} onCheckedChange={(v) => setForm({ ...form, promotion_recommended: v })} />
                  <Label>Promotion recommended</Label>
                </div>
                <div>
                  <Label>Status</Label>
                  <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="DRAFT">Draft</SelectItem>
                      <SelectItem value="SUBMITTED">Submitted</SelectItem>
                      <SelectItem value="ACKNOWLEDGED">Acknowledged</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter><Button onClick={save}>Save</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Target className="h-5 w-5" />Reviews</CardTitle>
          <CardDescription>{rows.length} review{rows.length !== 1 ? "s" : ""}</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  {canManage && <TableHead>Employee</TableHead>}
                  <TableHead>Period</TableHead>
                  <TableHead>KPI</TableHead>
                  <TableHead>Promotion</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Comments</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No reviews.</TableCell></TableRow>
                ) : rows.map((r) => (
                  <TableRow key={r.id}>
                    {canManage && (
                      <TableCell>
                        <div className="font-medium">{r.employee?.full_name}</div>
                        <div className="text-xs text-muted-foreground">{r.employee?.staff_id}</div>
                      </TableCell>
                    )}
                    <TableCell>
                      <div className="font-medium">{r.period_label}</div>
                      <Badge variant="outline" className="text-xs mt-1">{r.period_type}</Badge>
                    </TableCell>
                    <TableCell>{r.kpi_score ?? "—"}</TableCell>
                    <TableCell>{r.promotion_recommended ? <Badge>Yes</Badge> : "No"}</TableCell>
                    <TableCell><Badge variant="outline">{r.status}</Badge></TableCell>
                    <TableCell className="text-sm max-w-[200px] truncate">{r.supervisor_comments || r.goals || "—"}</TableCell>
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
