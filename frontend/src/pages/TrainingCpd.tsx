import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { useAuth } from "@/contexts/AuthContext";
import { useRole } from "@/hooks/useRole";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Award, BookOpen, Loader2, Plus, UserPlus } from "lucide-react";

const db = supabase as any;

interface Course {
  id: string; title: string; provider: string | null; cpd_points: number;
  is_internal: boolean; is_mandatory: boolean; is_active: boolean;
}
interface Training {
  id: string; employee_id: string; course_id: string | null; course_title: string;
  completed_at: string | null; cpd_points: number;
  employee?: { full_name: string; staff_id: string };
}
interface StaffOpt { id: string; full_name: string; staff_id: string }

export default function TrainingCpd() {
  const { user } = useAuth();
  const { hasRole } = useRole();
  const canManage = hasRole("ADMIN");
  const [courses, setCourses] = useState<Course[]>([]);
  const [trainings, setTrainings] = useState<Training[]>([]);
  const [staff, setStaff] = useState<StaffOpt[]>([]);
  const [loading, setLoading] = useState(true);
  const [courseOpen, setCourseOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [courseForm, setCourseForm] = useState({ title: "", provider: "", cpd_points: "0", is_internal: true, is_mandatory: false });
  const [assignForm, setAssignForm] = useState({ employee_id: "", course_id: "", completed_at: "" });

  const load = async () => {
    setLoading(true);
    const { data: c, error: ce } = await db.from("training_courses").select("*").order("title");
    if (ce) toast.error(ce.message);
    setCourses((c as Course[]) || []);

    let q = db.from("employee_training")
      .select("*, employee:profiles!employee_training_employee_id_fkey(full_name, staff_id)")
      .order("created_at", { ascending: false });
    if (!canManage && user) q = q.eq("employee_id", user.id);
    const { data: t, error: te } = await q;
    if (te) toast.error(te.message);
    setTrainings((t as Training[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    if (canManage) {
      supabase.from("profiles").select("id, full_name, staff_id").eq("is_active", true).order("full_name")
        .then(({ data }) => setStaff((data as StaffOpt[]) || []));
    }
  }, [canManage]);

  useEffect(() => { if (user) load(); }, [user, canManage]);

  const myCpd = useMemo(() =>
    trainings.filter((t) => t.employee_id === user?.id).reduce((s, t) => s + Number(t.cpd_points || 0), 0)
  , [trainings, user]);

  const addCourse = async () => {
    if (!courseForm.title.trim()) return toast.error("Title required");
    const { error } = await db.from("training_courses").insert({
      title: courseForm.title.trim(),
      provider: courseForm.provider.trim() || null,
      cpd_points: Number(courseForm.cpd_points) || 0,
      is_internal: courseForm.is_internal,
      is_mandatory: courseForm.is_mandatory,
      is_active: true,
    });
    if (error) return toast.error(error.message);
    toast.success("Course added");
    setCourseOpen(false); setCourseForm({ title: "", provider: "", cpd_points: "0", is_internal: true, is_mandatory: false }); load();
  };

  const assign = async () => {
    if (!assignForm.employee_id || !assignForm.course_id) return toast.error("Employee and course required");
    const course = courses.find((c) => c.id === assignForm.course_id);
    if (!course) return;
    const { error } = await db.from("employee_training").insert({
      employee_id: assignForm.employee_id,
      course_id: course.id,
      course_title: course.title,
      cpd_points: course.cpd_points,
      completed_at: assignForm.completed_at || null,
    });
    if (error) return toast.error(error.message);
    toast.success("Training assigned");
    setAssignOpen(false); setAssignForm({ employee_id: "", course_id: "", completed_at: "" }); load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Training & CPD</h1>
          <p className="text-muted-foreground">Courses, assignments, and continuing professional development.</p>
        </div>
        {canManage && (
          <div className="flex gap-2">
            <Dialog open={courseOpen} onOpenChange={setCourseOpen}>
              <DialogTrigger asChild><Button variant="outline"><Plus className="h-4 w-4 mr-2" />Course</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Add Course</DialogTitle></DialogHeader>
                <div className="grid gap-3 py-2">
                  <div><Label>Title</Label><Input value={courseForm.title} onChange={(e) => setCourseForm({ ...courseForm, title: e.target.value })} /></div>
                  <div><Label>Provider</Label><Input value={courseForm.provider} onChange={(e) => setCourseForm({ ...courseForm, provider: e.target.value })} /></div>
                  <div><Label>CPD points</Label><Input type="number" value={courseForm.cpd_points} onChange={(e) => setCourseForm({ ...courseForm, cpd_points: e.target.value })} /></div>
                  <div className="flex items-center gap-2"><Switch checked={courseForm.is_internal} onCheckedChange={(v) => setCourseForm({ ...courseForm, is_internal: v })} /><Label>Internal</Label></div>
                  <div className="flex items-center gap-2"><Switch checked={courseForm.is_mandatory} onCheckedChange={(v) => setCourseForm({ ...courseForm, is_mandatory: v })} /><Label>Mandatory</Label></div>
                </div>
                <DialogFooter><Button onClick={addCourse}>Save</Button></DialogFooter>
              </DialogContent>
            </Dialog>
            <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
              <DialogTrigger asChild><Button><UserPlus className="h-4 w-4 mr-2" />Assign</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Assign Training</DialogTitle></DialogHeader>
                <div className="grid gap-3 py-2">
                  <div>
                    <Label>Employee</Label>
                    <Select value={assignForm.employee_id} onValueChange={(v) => setAssignForm({ ...assignForm, employee_id: v })}>
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>
                        {staff.map((s) => <SelectItem key={s.id} value={s.id}>{s.full_name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Course</Label>
                    <Select value={assignForm.course_id} onValueChange={(v) => setAssignForm({ ...assignForm, course_id: v })}>
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>
                        {courses.filter((c) => c.is_active).map((c) => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div><Label>Completed at</Label><Input type="date" value={assignForm.completed_at} onChange={(e) => setAssignForm({ ...assignForm, completed_at: e.target.value })} /></div>
                </div>
                <DialogFooter><Button onClick={assign}>Assign</Button></DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        )}
      </div>

      {!canManage && (
        <Card>
          <CardContent className="pt-6 flex items-center gap-3">
            <Award className="h-8 w-8 text-primary" />
            <div>
              <div className="text-2xl font-bold">{myCpd}</div>
              <div className="text-sm text-muted-foreground">Total CPD points</div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><BookOpen className="h-5 w-5" />Courses</CardTitle>
            <CardDescription>{courses.length} course{courses.length !== 1 ? "s" : ""}</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin" /></div> : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>CPD</TableHead>
                    <TableHead>Flags</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {courses.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell>
                        <div className="font-medium">{c.title}</div>
                        <div className="text-xs text-muted-foreground">{c.provider || "—"}</div>
                      </TableCell>
                      <TableCell>{c.cpd_points}</TableCell>
                      <TableCell className="space-x-1">
                        {c.is_mandatory && <Badge variant="secondary">Mandatory</Badge>}
                        {c.is_internal && <Badge variant="outline">Internal</Badge>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Training records</CardTitle>
            <CardDescription>{canManage ? "All assignments" : "Your training"}</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  {canManage && <TableHead>Employee</TableHead>}
                  <TableHead>Course</TableHead>
                  <TableHead>CPD</TableHead>
                  <TableHead>Completed</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {trainings.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">No records.</TableCell></TableRow>
                ) : trainings.map((t) => (
                  <TableRow key={t.id}>
                    {canManage && <TableCell>{t.employee?.full_name}</TableCell>}
                    <TableCell className="font-medium">{t.course_title}</TableCell>
                    <TableCell>{t.cpd_points}</TableCell>
                    <TableCell>{t.completed_at ? format(new Date(t.completed_at + "T00:00:00"), "dd MMM yyyy") : "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
