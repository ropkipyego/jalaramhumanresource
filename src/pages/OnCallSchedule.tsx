import { useEffect, useState } from "react";
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
import { PhoneCall, Loader2, Plus } from "lucide-react";

const db = supabase as any;

interface Slot {
  id: string;
  department_id: string;
  employee_id: string;
  slot_date: string;
  start_time: string;
  end_time: string;
  notes: string | null;
  employee?: { full_name: string; staff_id: string };
  department?: { name: string };
}
interface Opt { id: string; name?: string; full_name?: string; staff_id?: string }

const empty = { department_id: "", employee_id: "", slot_date: "", start_time: "18:00", end_time: "08:00", notes: "" };

export default function OnCallSchedule() {
  const { user } = useAuth();
  const { hasRole } = useRole();
  const canManage = hasRole("HEAD");
  const [slots, setSlots] = useState<Slot[]>([]);
  const [depts, setDepts] = useState<Opt[]>([]);
  const [staff, setStaff] = useState<Opt[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);

  const load = async () => {
    setLoading(true);
    const today = format(new Date(), "yyyy-MM-dd");
    const { data, error } = await db.from("on_call_slots")
      .select("*, employee:profiles!on_call_slots_employee_id_fkey(full_name, staff_id), department:departments(name)")
      .gte("slot_date", today)
      .order("slot_date")
      .limit(100);
    if (error) toast.error(error.message);
    setSlots((data as Slot[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    supabase.from("departments").select("id, name").eq("is_active", true).order("name")
      .then(({ data }) => setDepts((data as Opt[]) || []));
    supabase.from("profiles").select("id, full_name, staff_id").eq("is_active", true).order("full_name")
      .then(({ data }) => setStaff((data as Opt[]) || []));
  }, []);

  const save = async () => {
    if (!form.department_id || !form.employee_id || !form.slot_date)
      return toast.error("Department, employee and date required");
    const { error } = await db.from("on_call_slots").insert({
      department_id: form.department_id,
      employee_id: form.employee_id,
      slot_date: form.slot_date,
      start_time: form.start_time || "18:00",
      end_time: form.end_time || "08:00",
      notes: form.notes.trim() || null,
      created_by: user!.id,
    });
    if (error) return toast.error(error.message);
    toast.success("On-call slot added");
    setOpen(false); setForm(empty); load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">On-Call Schedule</h1>
          <p className="text-muted-foreground">Upcoming on-call duty assignments.</p>
        </div>
        {canManage && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" />Add Slot</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>New On-Call Slot</DialogTitle></DialogHeader>
              <div className="grid gap-3 py-2">
                <div>
                  <Label>Department</Label>
                  <Select value={form.department_id} onValueChange={(v) => setForm({ ...form, department_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      {depts.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Employee</Label>
                  <Select value={form.employee_id} onValueChange={(v) => setForm({ ...form, employee_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      {staff.map((s) => <SelectItem key={s.id} value={s.id}>{s.full_name} ({s.staff_id})</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Date</Label><Input type="date" value={form.slot_date} onChange={(e) => setForm({ ...form, slot_date: e.target.value })} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Start</Label><Input type="time" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} /></div>
                  <div><Label>End</Label><Input type="time" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} /></div>
                </div>
                <div><Label>Notes</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
              </div>
              <DialogFooter><Button onClick={save}>Save</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><PhoneCall className="h-5 w-5" />Upcoming Slots</CardTitle>
          <CardDescription>{slots.length} upcoming</CardDescription>
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
                  <TableHead>Department</TableHead>
                  <TableHead>Hours</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {slots.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No upcoming slots.</TableCell></TableRow>
                ) : slots.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{format(new Date(s.slot_date + "T00:00:00"), "dd MMM yyyy")}</TableCell>
                    <TableCell>
                      <div>{s.employee?.full_name}</div>
                      <div className="text-xs text-muted-foreground">{s.employee?.staff_id}</div>
                    </TableCell>
                    <TableCell>{s.department?.name}</TableCell>
                    <TableCell className="text-sm">{String(s.start_time).slice(0, 5)} – {String(s.end_time).slice(0, 5)}</TableCell>
                    <TableCell className="text-sm">{s.notes || "—"}</TableCell>
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
