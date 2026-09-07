import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useRole } from "@/hooks/useRole";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Briefcase, Loader2, Plus, Users } from "lucide-react";

const db = supabase as any;
const APP_STATUSES = ["APPLIED","SHORTLISTED","INTERVIEW","OFFERED","HIRED","REJECTED","WITHDRAWN"] as const;

interface Vacancy {
  id: string; title: string; openings: number; status: string; description: string | null;
  requirements: string | null; posted_at: string; closes_at: string | null; department_id: string | null;
  department?: { name: string };
}
interface Applicant {
  id: string; vacancy_id: string; full_name: string; email: string; phone: string | null;
  status: string; interview_score: number | null; cover_letter: string | null;
}
interface Dept { id: string; name: string }

const vacEmpty = { title: "", department_id: "", openings: "1", description: "", requirements: "", closes_at: "" };
const appEmpty = { full_name: "", email: "", phone: "", cover_letter: "" };

export default function Recruitment() {
  const { user } = useAuth();
  const { hasRole } = useRole();
  const canAccess = hasRole("ADMIN");
  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [applicants, setApplicants] = useState<Applicant[]>([]);
  const [depts, setDepts] = useState<Dept[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [vacOpen, setVacOpen] = useState(false);
  const [appOpen, setAppOpen] = useState(false);
  const [vacForm, setVacForm] = useState(vacEmpty);
  const [appForm, setAppForm] = useState(appEmpty);

  const loadVacancies = async () => {
    setLoading(true);
    const { data, error } = await db.from("vacancies")
      .select("*, department:departments(name)").order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setVacancies((data as Vacancy[]) || []);
    setLoading(false);
  };

  const loadApplicants = async (vacancyId: string) => {
    const { data, error } = await db.from("applicants").select("*").eq("vacancy_id", vacancyId).order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setApplicants((data as Applicant[]) || []);
  };

  useEffect(() => {
    if (!canAccess) return;
    loadVacancies();
    supabase.from("departments").select("id, name").eq("is_active", true).order("name")
      .then(({ data }) => setDepts((data as Dept[]) || []));
  }, [canAccess]);

  useEffect(() => { if (selected) loadApplicants(selected); else setApplicants([]); }, [selected]);

  if (!canAccess) return <Navigate to="/dashboard" replace />;

  const saveVacancy = async () => {
    if (!vacForm.title.trim()) return toast.error("Title required");
    const { error } = await db.from("vacancies").insert({
      title: vacForm.title.trim(),
      department_id: vacForm.department_id || null,
      openings: Number(vacForm.openings) || 1,
      description: vacForm.description.trim() || null,
      requirements: vacForm.requirements.trim() || null,
      closes_at: vacForm.closes_at || null,
      created_by: user!.id,
      status: "OPEN",
    });
    if (error) return toast.error(error.message);
    toast.success("Vacancy created");
    setVacOpen(false); setVacForm(vacEmpty); loadVacancies();
  };

  const addApplicant = async () => {
    if (!selected) return;
    if (!appForm.full_name.trim() || !appForm.email.trim()) return toast.error("Name and email required");
    const { error } = await db.from("applicants").insert({
      vacancy_id: selected,
      full_name: appForm.full_name.trim(),
      email: appForm.email.trim(),
      phone: appForm.phone.trim() || null,
      cover_letter: appForm.cover_letter.trim() || null,
      status: "APPLIED",
    });
    if (error) return toast.error(error.message);
    toast.success("Applicant added");
    setAppOpen(false); setAppForm(appEmpty); loadApplicants(selected);
  };

  const updateApplicant = async (id: string, patch: Partial<Applicant>) => {
    const { error } = await db.from("applicants").update(patch).eq("id", id);
    if (error) toast.error(error.message);
    else if (selected) loadApplicants(selected);
  };

  const setVacStatus = async (id: string, status: string) => {
    const { error } = await db.from("vacancies").update({ status }).eq("id", id);
    if (error) toast.error(error.message);
    else loadVacancies();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Recruitment</h1>
          <p className="text-muted-foreground">Manage vacancies and applicants.</p>
        </div>
        <Dialog open={vacOpen} onOpenChange={setVacOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />New Vacancy</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create Vacancy</DialogTitle></DialogHeader>
            <div className="grid gap-3 py-2">
              <div><Label>Title</Label><Input value={vacForm.title} onChange={(e) => setVacForm({ ...vacForm, title: e.target.value })} /></div>
              <div>
                <Label>Department</Label>
                <Select value={vacForm.department_id || "none"} onValueChange={(v) => setVacForm({ ...vacForm, department_id: v === "none" ? "" : v })}>
                  <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {depts.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Openings</Label><Input type="number" min={1} value={vacForm.openings} onChange={(e) => setVacForm({ ...vacForm, openings: e.target.value })} /></div>
              <div><Label>Closes</Label><Input type="date" value={vacForm.closes_at} onChange={(e) => setVacForm({ ...vacForm, closes_at: e.target.value })} /></div>
              <div><Label>Description</Label><Textarea value={vacForm.description} onChange={(e) => setVacForm({ ...vacForm, description: e.target.value })} /></div>
              <div><Label>Requirements</Label><Textarea value={vacForm.requirements} onChange={(e) => setVacForm({ ...vacForm, requirements: e.target.value })} /></div>
            </div>
            <DialogFooter><Button onClick={saveVacancy}>Save</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Briefcase className="h-5 w-5" />Vacancies</CardTitle>
            <CardDescription>{vacancies.length} total</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin" /></div> : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vacancies.map((v) => (
                    <TableRow key={v.id} className={selected === v.id ? "bg-muted/50" : "cursor-pointer"} onClick={() => setSelected(v.id)}>
                      <TableCell>
                        <div className="font-medium">{v.title}</div>
                        <div className="text-xs text-muted-foreground">{v.department?.name || "—"} · {v.openings} opening(s)</div>
                      </TableCell>
                      <TableCell><Badge variant="outline">{v.status}</Badge></TableCell>
                      <TableCell className="text-right">
                        {v.status === "OPEN" && (
                          <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); setVacStatus(v.id, "CLOSED"); }}>Close</Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" />Applicants</CardTitle>
              <CardDescription>{selected ? `${applicants.length} applicant(s)` : "Select a vacancy"}</CardDescription>
            </div>
            {selected && (
              <Dialog open={appOpen} onOpenChange={setAppOpen}>
                <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" />Add</Button></DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Add Applicant</DialogTitle></DialogHeader>
                  <div className="grid gap-3 py-2">
                    <div><Label>Full name</Label><Input value={appForm.full_name} onChange={(e) => setAppForm({ ...appForm, full_name: e.target.value })} /></div>
                    <div><Label>Email</Label><Input type="email" value={appForm.email} onChange={(e) => setAppForm({ ...appForm, email: e.target.value })} /></div>
                    <div><Label>Phone</Label><Input value={appForm.phone} onChange={(e) => setAppForm({ ...appForm, phone: e.target.value })} /></div>
                    <div><Label>Cover letter</Label><Textarea value={appForm.cover_letter} onChange={(e) => setAppForm({ ...appForm, cover_letter: e.target.value })} /></div>
                  </div>
                  <DialogFooter><Button onClick={addApplicant}>Save</Button></DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </CardHeader>
          <CardContent>
            {!selected ? (
              <p className="text-sm text-muted-foreground py-8 text-center">Select a vacancy to view applicants.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Score</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {applicants.length === 0 ? (
                    <TableRow><TableCell colSpan={3} className="text-center py-6 text-muted-foreground">No applicants.</TableCell></TableRow>
                  ) : applicants.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell>
                        <div className="font-medium">{a.full_name}</div>
                        <div className="text-xs text-muted-foreground">{a.email}</div>
                      </TableCell>
                      <TableCell>
                        <Select value={a.status} onValueChange={(v) => updateApplicant(a.id, { status: v })}>
                          <SelectTrigger className="h-8 w-36"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {APP_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number" className="h-8 w-20" min={0} max={100}
                          defaultValue={a.interview_score ?? ""}
                          onBlur={(e) => {
                            const v = e.target.value === "" ? null : Number(e.target.value);
                            if (v !== a.interview_score) updateApplicant(a.id, { interview_score: v });
                          }}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
