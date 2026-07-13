import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useRole } from "@/hooks/useRole";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { ClipboardList, Loader2, Pencil } from "lucide-react";
import type { Department, DepartmentRules } from "@/types/database";

type RuleRow = DepartmentRules & { department?: Department };

const defaults = { min_staff_day: 2, min_staff_night: 1, max_consecutive_nights: 3, min_rest_hours: 11 };

export default function DepartmentRulesPage() {
  const { isSuperAdmin, hasRole } = useRole();
  const canView = hasRole("HEAD");
  const canEdit = isSuperAdmin;

  const [departments, setDepartments] = useState<Department[]>([]);
  const [rules, setRules] = useState<RuleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Department | null>(null);
  const [form, setForm] = useState(defaults);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const [deptRes, rulesRes] = await Promise.all([
      supabase.from("departments").select("*").eq("is_active", true).order("name"),
      supabase.from("department_rules").select("*, department:departments(id,name,code)"),
    ]);
    setDepartments((deptRes.data as Department[]) || []);
    setRules((rulesRes.data as RuleRow[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    if (canView) load();
  }, [canView]);

  if (!canView) return <Navigate to="/dashboard" replace />;

  const openEdit = (dept: Department) => {
    const existing = rules.find((r) => r.department_id === dept.id);
    setEditing(dept);
    setForm(existing ? {
      min_staff_day: existing.min_staff_day,
      min_staff_night: existing.min_staff_night,
      max_consecutive_nights: existing.max_consecutive_nights,
      min_rest_hours: existing.min_rest_hours,
    } : defaults);
  };

  const save = async () => {
    if (!editing) return;
    setSaving(true);
    const existing = rules.find((r) => r.department_id === editing.id);
    const payload = { department_id: editing.id, ...form };
    const res = existing
      ? await supabase.from("department_rules").update(form).eq("id", existing.id)
      : await supabase.from("department_rules").insert(payload);
    setSaving(false);
    if (res.error) toast.error(res.error.message);
    else {
      toast.success("Rules saved");
      setEditing(null);
      load();
    }
  };

  const getRule = (deptId: string) => rules.find((r) => r.department_id === deptId);

  if (loading) return <div className="flex justify-center h-64 items-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Department Rules</h1>
        <p className="text-muted-foreground">
          Minimum staffing and rest rules used by rota validation.
          {!canEdit && " View only — contact Super Admin to edit."}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><ClipboardList className="h-5 w-5" />Staffing Rules by Department</CardTitle>
          <CardDescription>{departments.length} active departments</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Department</TableHead>
                <TableHead>Min Day</TableHead>
                <TableHead>Min Night</TableHead>
                <TableHead>Max Consec. Nights</TableHead>
                <TableHead>Min Rest (hrs)</TableHead>
                {canEdit && <TableHead className="text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {departments.map((d) => {
                const r = getRule(d.id);
                return (
                  <TableRow key={d.id}>
                    <TableCell>
                      <div className="font-medium">{d.name}</div>
                      <div className="text-xs text-muted-foreground">{d.code}</div>
                    </TableCell>
                    <TableCell>{r?.min_staff_day ?? <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell>{r?.min_staff_night ?? <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell>{r?.max_consecutive_nights ?? <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell>{r?.min_rest_hours ?? <span className="text-muted-foreground">—</span>}</TableCell>
                    {canEdit && (
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(d)}>
                          <Pencil className="h-4 w-4 mr-1" />
                          {r ? "Edit" : "Configure"}
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rules for {editing?.name}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
            {([
              ["min_staff_day", "Min Staff (Day)"],
              ["min_staff_night", "Min Staff (Night)"],
              ["max_consecutive_nights", "Max Consecutive Nights"],
              ["min_rest_hours", "Min Rest Hours"],
            ] as const).map(([key, label]) => (
              <div key={key}>
                <Label>{label}</Label>
                <Input
                  type="number" min={0}
                  value={form[key]}
                  onChange={(e) => setForm({ ...form, [key]: +e.target.value })}
                />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Rules
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
