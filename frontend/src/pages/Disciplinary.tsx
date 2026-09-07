import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { format } from "date-fns";
import { useAuth } from "@/contexts/AuthContext";
import { useRole } from "@/hooks/useRole";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Gavel, Loader2, Plus } from "lucide-react";

const db = supabase as any;

interface Record {
  id: string;
  employee_id: string;
  incident_date: string;
  category: string;
  description: string;
  action_taken: string | null;
  created_at: string;
  employee?: { full_name: string; staff_id: string };
}
interface StaffOpt { id: string; full_name: string; staff_id: string }

const empty = { employee_id: "", incident_date: format(new Date(), "yyyy-MM-dd"), category: "", description: "", action_taken: "" };

export default function Disciplinary() {
  const { user } = useAuth();
  const { hasRole } = useRole();
  const canAccess = hasRole("ADMIN");
  const [rows, setRows] = useState<Record[]>([]);
  const [staff, setStaff] = useState<StaffOpt[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);

  const load = async () => {
    setLoading(true);
    const { data, error } = await db.from("disciplinary_records")
      .select("*, employee:profiles!disciplinary_records_employee_id_fkey(full_name, staff_id)")
      .order("incident_date", { ascending: false });
    if (error) toast.error(error.message);
    setRows((data as Record[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    if (!canAccess) return;
    load();
    supabase.from("profiles").select("id, full_name, staff_id").eq("is_active", true).order("full_name")
      .then(({ data }) => setStaff((data as StaffOpt[]) || []));
  }, [canAccess]);

  if (!canAccess) return <Navigate to="/dashboard" replace />;

  const save = async () => {
    if (!form.employee_id || !form.category.trim() || !form.description.trim())
      return toast.error("Employee, category and description required");
    const { error } = await db.from("disciplinary_records").insert({
      employee_id: form.employee_id,
      incident_date: form.incident_date,
      category: form.category.trim(),
      description: form.description.trim(),
      action_taken: form.action_taken.trim() || null,
      recorded_by: user!.id,
    });
    if (error) return toast.error(error.message);
    toast.success("Record added");
    setOpen(false); setForm(empty); load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Disciplinary Records</h1>
          <p className="text-muted-foreground">Document incidents and actions taken.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" />Add Record</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New Disciplinary Record</DialogTitle></DialogHeader>
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
              <div><Label>Incident date</Label><Input type="date" value={form.incident_date} onChange={(e) => setForm({ ...form, incident_date: e.target.value })} /></div>
              <div><Label>Category</Label><Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="e.g. Attendance, Conduct" /></div>
              <div><Label>Description</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
              <div><Label>Action taken</Label><Textarea value={form.action_taken} onChange={(e) => setForm({ ...form, action_taken: e.target.value })} /></div>
            </div>
            <DialogFooter><Button onClick={save}>Save</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Gavel className="h-5 w-5" />Records</CardTitle>
          <CardDescription>{rows.length} record{rows.length !== 1 ? "s" : ""}</CardDescription>
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
                  <TableHead>Category</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No records.</TableCell></TableRow>
                ) : rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{format(new Date(r.incident_date + "T00:00:00"), "dd MMM yyyy")}</TableCell>
                    <TableCell>
                      <div className="font-medium">{r.employee?.full_name}</div>
                      <div className="text-xs text-muted-foreground">{r.employee?.staff_id}</div>
                    </TableCell>
                    <TableCell>{r.category}</TableCell>
                    <TableCell className="text-sm max-w-[240px] truncate">{r.description}</TableCell>
                    <TableCell className="text-sm max-w-[200px] truncate">{r.action_taken || "—"}</TableCell>
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
