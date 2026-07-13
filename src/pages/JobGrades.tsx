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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Layers, Loader2, Plus } from "lucide-react";
import type { JobGrade } from "@/types/database";

const empty = { name: "", code: "", level: 1, min_salary: "", max_salary: "", description: "" };

export default function JobGrades() {
  const { role } = useAuth();
  const canAccess = role === "SUPER_ADMIN";
  const [rows, setRows] = useState<JobGrade[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState<string | null>(null);

  const load = async () => {
    const { data, error } = await supabase.from("job_grades").select("*").order("level");
    if (error) toast.error(error.message);
    setRows((data as JobGrade[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    if (canAccess) load();
  }, [canAccess]);

  if (!canAccess) return <Navigate to="/dashboard" replace />;

  const save = async () => {
    if (!form.name.trim() || !form.code.trim()) return toast.error("Name and code required");
    const payload = {
      name: form.name.trim(),
      code: form.code.trim().toUpperCase(),
      level: Number(form.level) || 1,
      min_salary: form.min_salary ? Number(form.min_salary) : null,
      max_salary: form.max_salary ? Number(form.max_salary) : null,
      description: form.description.trim() || null,
      is_active: true,
    };
    const res = editing
      ? await supabase.from("job_grades").update(payload).eq("id", editing)
      : await supabase.from("job_grades").insert(payload);
    if (res.error) return toast.error(res.error.message);
    toast.success(editing ? "Grade updated" : "Grade created");
    setOpen(false); setEditing(null); setForm(empty); load();
  };

  const edit = (g: JobGrade) => {
    setEditing(g.id);
    setForm({
      name: g.name, code: g.code, level: g.level,
      min_salary: g.min_salary?.toString() ?? "",
      max_salary: g.max_salary?.toString() ?? "",
      description: g.description ?? "",
    });
    setOpen(true);
  };

  const toggleActive = async (g: JobGrade) => {
    const { error } = await supabase.from("job_grades").update({ is_active: !g.is_active }).eq("id", g.id);
    if (error) toast.error(error.message);
    else load();
  };

  const fmt = (n: number | null) => n != null ? `KES ${n.toLocaleString()}` : "—";

  if (loading) return <div className="flex justify-center h-64 items-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Job Grades</h1>
          <p className="text-muted-foreground">Salary bands and grade levels for positions.</p>
        </div>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setEditing(null); setForm(empty); } }}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" />New Grade</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editing ? "Edit" : "New"} Job Grade</DialogTitle></DialogHeader>
            <div className="grid gap-3 py-2">
              <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div><Label>Code</Label><Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} /></div>
              <div><Label>Level</Label><Input type="number" min={1} value={form.level} onChange={(e) => setForm({ ...form, level: +e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Min Salary</Label><Input type="number" value={form.min_salary} onChange={(e) => setForm({ ...form, min_salary: e.target.value })} /></div>
                <div><Label>Max Salary</Label><Input type="number" value={form.max_salary} onChange={(e) => setForm({ ...form, max_salary: e.target.value })} /></div>
              </div>
              <div><Label>Description</Label><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            </div>
            <DialogFooter><Button onClick={save}>Save</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Layers className="h-5 w-5" />All Grades</CardTitle>
          <CardDescription>{rows.length} grade{rows.length !== 1 ? "s" : ""}</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Grade</TableHead>
                <TableHead>Level</TableHead>
                <TableHead>Salary Band</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((g) => (
                <TableRow key={g.id}>
                  <TableCell>
                    <div className="font-medium">{g.name}</div>
                    <Badge variant="outline" className="text-xs mt-1">{g.code}</Badge>
                  </TableCell>
                  <TableCell>{g.level}</TableCell>
                  <TableCell className="text-sm">{fmt(g.min_salary)} – {fmt(g.max_salary)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Switch checked={g.is_active} onCheckedChange={() => toggleActive(g)} />
                      <span className="text-xs">{g.is_active ? "Active" : "Inactive"}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => edit(g)}>Edit</Button>
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
