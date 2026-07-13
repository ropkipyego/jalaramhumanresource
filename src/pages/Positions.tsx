import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Briefcase, Loader2, Plus } from "lucide-react";
import type { Department, JobGrade, Position } from "@/types/database";

const empty = { title: "", code: "", department_id: "", grade_id: "", description: "" };

export default function Positions() {
  const { role } = useAuth();
  const canAccess = role === "SUPER_ADMIN";
  const [rows, setRows] = useState<Position[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [grades, setGrades] = useState<JobGrade[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState<string | null>(null);

  const load = async () => {
    const [pos, depts, gr] = await Promise.all([
      supabase.from("positions").select("*, department:departments(id,name,code), grade:job_grades(id,name,code)").order("title"),
      supabase.from("departments").select("*").eq("is_active", true).order("name"),
      supabase.from("job_grades").select("*").eq("is_active", true).order("level"),
    ]);
    if (pos.error) toast.error(pos.error.message);
    setRows((pos.data as Position[]) || []);
    setDepartments((depts.data as Department[]) || []);
    setGrades((gr.data as JobGrade[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    if (canAccess) load();
  }, [canAccess]);

  if (!canAccess) return <Navigate to="/dashboard" replace />;

  const save = async () => {
    if (!form.title.trim() || !form.code.trim()) return toast.error("Title and code required");
    const payload = {
      title: form.title.trim(),
      code: form.code.trim().toUpperCase(),
      department_id: form.department_id || null,
      grade_id: form.grade_id || null,
      description: form.description.trim() || null,
      is_active: true,
    };
    const res = editing
      ? await supabase.from("positions").update(payload).eq("id", editing)
      : await supabase.from("positions").insert(payload);
    if (res.error) return toast.error(res.error.message);
    toast.success(editing ? "Position updated" : "Position created");
    setOpen(false); setEditing(null); setForm(empty); load();
  };

  const edit = (p: Position) => {
    setEditing(p.id);
    setForm({
      title: p.title, code: p.code,
      department_id: p.department_id ?? "",
      grade_id: p.grade_id ?? "",
      description: p.description ?? "",
    });
    setOpen(true);
  };

  const toggleActive = async (p: Position) => {
    const { error } = await supabase.from("positions").update({ is_active: !p.is_active }).eq("id", p.id);
    if (error) toast.error(error.message);
    else load();
  };

  if (loading) return <div className="flex justify-center h-64 items-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Positions</h1>
          <p className="text-muted-foreground">Job titles linked to departments and grades.</p>
        </div>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setEditing(null); setForm(empty); } }}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" />New Position</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editing ? "Edit" : "New"} Position</DialogTitle></DialogHeader>
            <div className="grid gap-3 py-2">
              <div><Label>Title</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Senior Nurse" /></div>
              <div><Label>Code</Label><Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="SNR_NURSE" /></div>
              <div>
                <Label>Department</Label>
                <Select value={form.department_id || "none"} onValueChange={(v) => setForm({ ...form, department_id: v === "none" ? "" : v })}>
                  <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {departments.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Grade</Label>
                <Select value={form.grade_id || "none"} onValueChange={(v) => setForm({ ...form, grade_id: v === "none" ? "" : v })}>
                  <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {grades.map((g) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Description</Label><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            </div>
            <DialogFooter><Button onClick={save}>Save</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Briefcase className="h-5 w-5" />All Positions</CardTitle>
          <CardDescription>{rows.length} position{rows.length !== 1 ? "s" : ""}</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Position</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Grade</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <div className="font-medium">{p.title}</div>
                    <Badge variant="outline" className="text-xs mt-1">{p.code}</Badge>
                  </TableCell>
                  <TableCell>{(p as any).department?.name ?? "—"}</TableCell>
                  <TableCell>{(p as any).grade?.name ?? "—"}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Switch checked={p.is_active} onCheckedChange={() => toggleActive(p)} />
                      <span className="text-xs">{p.is_active ? "Active" : "Inactive"}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => edit(p)}>Edit</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
