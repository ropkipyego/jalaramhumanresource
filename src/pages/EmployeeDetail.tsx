import { useEffect, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { useRole } from "@/hooks/useRole";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { ArrowLeft, CheckCircle2, Circle, Loader2, User, UserX } from "lucide-react";
import type { Branch, EmploymentType, Gender, HrStatus, JobGrade, Position } from "@/types/database";

interface OnboardingItem {
  id: string;
  title: string;
  is_completed: boolean;
  completed_at: string | null;
  notes: string | null;
}

export default function EmployeeDetail() {
  const { id } = useParams<{ id: string }>();
  const { hasRole } = useRole();
  const canAccess = hasRole("ADMIN");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<Record<string, unknown> | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [grades, setGrades] = useState<JobGrade[]>([]);
  const [managers, setManagers] = useState<{ id: string; full_name: string }[]>([]);
  const [onboarding, setOnboarding] = useState<OnboardingItem[]>([]);
  const [offboardOpen, setOffboardOpen] = useState(false);
  const [offboardReason, setOffboardReason] = useState("");
  const [offboarding, setOffboarding] = useState(false);

  const load = async () => {
    if (!id) return;
    setLoading(true);
    const [prof, br, pos, gr, mgr, ob] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", id).maybeSingle(),
      supabase.from("branches").select("*").eq("is_active", true).order("name"),
      supabase.from("positions").select("*").eq("is_active", true).order("title"),
      supabase.from("job_grades").select("*").eq("is_active", true).order("level"),
      supabase.from("profiles").select("id, full_name").eq("hr_status", "ACTIVE").neq("id", id).order("full_name"),
      supabase.from("employee_onboarding_items").select("*").eq("employee_id", id).order("title"),
    ]);
    if (!prof.data) { setLoading(false); return; }
    setProfile(prof.data);
    setBranches((br.data as Branch[]) || []);
    setPositions((pos.data as Position[]) || []);
    setGrades((gr.data as JobGrade[]) || []);
    setManagers((mgr.data as { id: string; full_name: string }[]) || []);
    setOnboarding((ob.data as OnboardingItem[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    if (canAccess && id) load();
  }, [canAccess, id]);

  if (!canAccess) return <Navigate to="/dashboard" replace />;
  if (loading) return <div className="flex justify-center h-64 items-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  if (!profile) return (
    <div className="text-center py-16">
      <p className="text-muted-foreground mb-4">Employee not found.</p>
      <Button asChild variant="outline"><Link to="/staff"><ArrowLeft className="mr-2 h-4 w-4" />Back to Directory</Link></Button>
    </div>
  );

  const set = (key: string, value: unknown) => setProfile((p) => p ? { ...p, [key]: value } : p);

  const save = async () => {
    if (!id || !profile) return;
    setSaving(true);
    const p = profile as Record<string, any>;
    const payload: Record<string, any> = {
      phone: p.phone || null,
      address: p.address || null,
      gender: p.gender || null,
      date_of_birth: p.date_of_birth || null,
      passport_no: p.passport_no || null,
      biometric_enroll_id: p.biometric_enroll_id || null,
      national_id: p.national_id || null,
      branch_id: p.branch_id || null,
      position_id: p.position_id || null,
      grade_id: p.grade_id || null,
      manager_id: p.manager_id || null,
      designation: p.designation || null,
      employment_type: p.employment_type || null,
      hr_status: p.hr_status,
      date_joined: p.date_joined || null,
      contract_end_date: p.contract_end_date || null,
      probation_end_date: p.probation_end_date || null,
      basic_salary: p.basic_salary ?? null,
      kra_pin: p.kra_pin || null,
      nssf_number: p.nssf_number || null,
      shif_number: p.shif_number || null,
      next_of_kin_name: p.next_of_kin_name || null,
      next_of_kin_phone: p.next_of_kin_phone || null,
      practicing_license_no: p.practicing_license_no || null,
      license_expiry_date: p.license_expiry_date || null,
      bank_name: p.bank_name || null,
      bank_branch: p.bank_branch || null,
      bank_account: p.bank_account || null,
    };
    const { error } = await supabase.from("profiles").update(payload).eq("id", id);
    setSaving(false);
    if (error) toast.error(error.message);
    else toast.success("Employee record updated");
  };

  const initOnboarding = async () => {
    if (!id) return;
    const { data: templates } = await supabase.from("onboarding_checklist_templates").select("*").eq("is_active", true).order("sort_order");
    if (!templates?.length) return toast.error("No onboarding templates configured");
    const existing = new Set(onboarding.map((o) => o.title));
    const toInsert = templates.filter((t) => !existing.has(t.title)).map((t) => ({
      employee_id: id, template_id: t.id, title: t.title,
    }));
    if (!toInsert.length) return toast.info("Checklist already initialized");
    const { error } = await supabase.from("employee_onboarding_items").insert(toInsert);
    if (error) toast.error(error.message);
    else { toast.success("Onboarding checklist created"); load(); }
  };

  const toggleOnboarding = async (item: OnboardingItem) => {
    const { error } = await supabase.from("employee_onboarding_items").update({
      is_completed: !item.is_completed,
      completed_at: !item.is_completed ? new Date().toISOString() : null,
    }).eq("id", item.id);
    if (error) toast.error(error.message);
    else load();
  };


  const doOffboard = async () => {
    if (!id) return;
    if (offboardReason.trim().length < 3) return toast.error("Please provide a reason");
    setOffboarding(true);
    const { error } = await supabase.rpc("offboard_employee" as any, {
      _employee_id: id, _reason: offboardReason.trim(),
    });
    setOffboarding(false);
    if (error) return toast.error(error.message);
    toast.success("Employee offboarded. Admins have been notified.");
    setOffboardOpen(false);
    load();
  };

  const p = profile;
  const completedCount = onboarding.filter((o) => o.is_completed).length;
  const isOffboarded = String(p.hr_status) === "TERMINATED";

  return (
    <div className="space-y-6 max-w-5xl animate-fade-in">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button asChild variant="ghost" size="icon"><Link to="/staff"><ArrowLeft className="h-4 w-4" /></Link></Button>
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
            <User className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">{String(p.full_name)}</h1>
            <p className="text-muted-foreground">{String(p.staff_id)} · {String(p.email)}</p>
            <div className="flex gap-2 mt-1">
              <Badge variant={isOffboarded ? "destructive" : "default"}>{String(p.hr_status ?? "ACTIVE")}</Badge>
              {p.employment_type && <Badge variant="outline">{String(p.employment_type)}</Badge>}
              {isOffboarded && p.offboarded_at && (
                <Badge variant="outline">Offboarded {new Date(String(p.offboarded_at)).toLocaleDateString()}</Badge>
              )}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          {!isOffboarded && (
            <Dialog open={offboardOpen} onOpenChange={setOffboardOpen}>
              <DialogTrigger asChild>
                <Button variant="destructive"><UserX className="mr-2 h-4 w-4" />Offboard</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Offboard {String(p.full_name)}?</DialogTitle>
                  <DialogDescription>
                    The employee will be marked <strong>Terminated</strong>, deactivated (cannot log in), removed from
                    department rosters, and all admins will be notified. This is auditable and can be reversed by editing
                    HR Status back to Active.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-2 py-2">
                  <Label>Reason for offboarding</Label>
                  <Textarea rows={3} value={offboardReason} onChange={(e) => setOffboardReason(e.target.value)}
                    placeholder="e.g. Resignation effective 30 June 2026" />
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setOffboardOpen(false)}>Cancel</Button>
                  <Button variant="destructive" onClick={doOffboard} disabled={offboarding}>
                    {offboarding && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Confirm Offboard
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Changes
          </Button>
        </div>
      </div>


      <Tabs defaultValue="personal">
        <TabsList>
          <TabsTrigger value="personal">Personal</TabsTrigger>
          <TabsTrigger value="employment">Employment</TabsTrigger>
          <TabsTrigger value="payroll">Payroll</TabsTrigger>
          <TabsTrigger value="emergency">Emergency</TabsTrigger>
          <TabsTrigger value="onboarding">Onboarding ({completedCount}/{onboarding.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="personal" className="mt-4">
          <Card>
            <CardHeader><CardTitle>Personal Details</CardTitle></CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div><Label>Phone</Label><Input value={String(p.phone ?? "")} onChange={(e) => set("phone", e.target.value)} /></div>
              <div><Label>National ID</Label><Input value={String(p.national_id ?? "")} onChange={(e) => set("national_id", e.target.value)} /></div>
              <div><Label>Biometric Enroll ID</Label><Input value={String(p.biometric_enroll_id ?? "")} onChange={(e) => set("biometric_enroll_id", e.target.value)} placeholder="Device user ID if different from Staff ID" /></div>
              <div><Label>Passport</Label><Input value={String(p.passport_no ?? "")} onChange={(e) => set("passport_no", e.target.value)} /></div>
              <div>
                <Label>Gender</Label>
                <Select value={String(p.gender ?? "none")} onValueChange={(v) => set("gender", v === "none" ? null : v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Not set</SelectItem>
                    {(["MALE", "FEMALE", "OTHER", "PREFER_NOT_TO_SAY"] as Gender[]).map((g) => (
                      <SelectItem key={g} value={g}>{g.replace(/_/g, " ")}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Date of Birth</Label><Input type="date" value={String(p.date_of_birth ?? "")} onChange={(e) => set("date_of_birth", e.target.value)} /></div>
              <div className="md:col-span-2"><Label>Address</Label><Input value={String(p.address ?? "")} onChange={(e) => set("address", e.target.value)} /></div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="employment" className="mt-4">
          <Card>
            <CardHeader><CardTitle>Employment Details</CardTitle></CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div><Label>Designation</Label><Input value={String(p.designation ?? "")} onChange={(e) => set("designation", e.target.value)} /></div>
              <div>
                <Label>Employment Type</Label>
                <Select value={String(p.employment_type ?? "none")} onValueChange={(v) => set("employment_type", v === "none" ? null : v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Not set</SelectItem>
                    {(["PERMANENT", "CONTRACT", "LOCUM", "INTERN"] as EmploymentType[]).map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Branch</Label>
                <Select value={String(p.branch_id ?? "none")} onValueChange={(v) => set("branch_id", v === "none" ? null : v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {branches.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Position</Label>
                <Select value={String(p.position_id ?? "none")} onValueChange={(v) => set("position_id", v === "none" ? null : v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {positions.map((pos) => <SelectItem key={pos.id} value={pos.id}>{pos.title}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Grade</Label>
                <Select value={String(p.grade_id ?? "none")} onValueChange={(v) => set("grade_id", v === "none" ? null : v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {grades.map((g) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Reporting Manager</Label>
                <Select value={String(p.manager_id ?? "none")} onValueChange={(v) => set("manager_id", v === "none" ? null : v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {managers.map((m) => <SelectItem key={m.id} value={m.id}>{m.full_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Date Joined</Label><Input type="date" value={String(p.date_joined ?? "")} onChange={(e) => set("date_joined", e.target.value)} /></div>
              <div><Label>Probation End</Label><Input type="date" value={String(p.probation_end_date ?? "")} onChange={(e) => set("probation_end_date", e.target.value)} /></div>
              <div><Label>Contract End</Label><Input type="date" value={String(p.contract_end_date ?? "")} onChange={(e) => set("contract_end_date", e.target.value)} /></div>
              <div>
                <Label>HR Status</Label>
                <Select value={String(p.hr_status ?? "ACTIVE")} onValueChange={(v) => set("hr_status", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(["ACTIVE", "SUSPENDED", "ON_LEAVE", "TERMINATED"] as HrStatus[]).map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payroll" className="mt-4">
          <Card>
            <CardHeader><CardTitle>Payroll & Statutory</CardTitle></CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div><Label>Basic Salary (KES)</Label><Input type="number" value={String(p.basic_salary ?? "")} onChange={(e) => set("basic_salary", e.target.value ? +e.target.value : null)} /></div>
              <div><Label>KRA PIN</Label><Input value={String(p.kra_pin ?? "")} onChange={(e) => set("kra_pin", e.target.value)} /></div>
              <div><Label>NSSF Number</Label><Input value={String(p.nssf_number ?? "")} onChange={(e) => set("nssf_number", e.target.value)} /></div>
              <div><Label>SHIF Number</Label><Input value={String(p.shif_number ?? "")} onChange={(e) => set("shif_number", e.target.value)} /></div>
              <div><Label>Practicing License</Label><Input value={String(p.practicing_license_no ?? "")} onChange={(e) => set("practicing_license_no", e.target.value)} /></div>
              <div><Label>License Expiry</Label><Input type="date" value={String(p.license_expiry_date ?? "")} onChange={(e) => set("license_expiry_date", e.target.value)} /></div>
              <div><Label>Bank Name</Label><Input value={String(p.bank_name ?? "")} onChange={(e) => set("bank_name", e.target.value)} /></div>
              <div><Label>Bank Branch</Label><Input value={String(p.bank_branch ?? "")} onChange={(e) => set("bank_branch", e.target.value)} /></div>
              <div><Label>Account Number</Label><Input value={String(p.bank_account ?? "")} onChange={(e) => set("bank_account", e.target.value)} /></div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="emergency" className="mt-4">
          <Card>
            <CardHeader><CardTitle>Next of Kin</CardTitle></CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div><Label>Name</Label><Input value={String(p.next_of_kin_name ?? "")} onChange={(e) => set("next_of_kin_name", e.target.value)} /></div>
              <div><Label>Phone</Label><Input value={String(p.next_of_kin_phone ?? "")} onChange={(e) => set("next_of_kin_phone", e.target.value)} /></div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="onboarding" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Onboarding Checklist</CardTitle>
                <CardDescription>{completedCount} of {onboarding.length} complete</CardDescription>
              </div>
              {onboarding.length === 0 && (
                <Button variant="outline" size="sm" onClick={initOnboarding}>Initialize Checklist</Button>
              )}
            </CardHeader>
            <CardContent className="space-y-3">
              {onboarding.length === 0 ? (
                <p className="text-muted-foreground text-sm">No checklist yet. Click Initialize to create from templates.</p>
              ) : onboarding.map((item) => (
                <div key={item.id} className="flex items-center gap-3 p-3 rounded-lg border">
                  <Checkbox checked={item.is_completed} onCheckedChange={() => toggleOnboarding(item)} />
                  {item.is_completed
                    ? <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
                    : <Circle className="h-4 w-4 text-muted-foreground shrink-0" />}
                  <span className={item.is_completed ? "line-through text-muted-foreground" : ""}>{item.title}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
