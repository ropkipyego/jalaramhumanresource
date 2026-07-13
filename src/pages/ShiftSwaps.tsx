import { useEffect, useState } from "react";
import { format } from "date-fns";
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
import { ArrowLeftRight, Loader2, Plus } from "lucide-react";

const db = supabase as any;

interface Swap {
  id: string;
  requester_id: string;
  target_id: string;
  requester_date: string;
  target_date: string;
  requester_shift: string | null;
  target_shift: string | null;
  reason: string | null;
  status: string;
  created_at: string;
  requester?: { full_name: string; staff_id: string };
  target?: { full_name: string; staff_id: string };
}
interface StaffOpt { id: string; full_name: string; staff_id: string }

const empty = { target_id: "", requester_date: "", target_date: "", requester_shift: "", target_shift: "", reason: "" };

export default function ShiftSwaps() {
  const { user } = useAuth();
  const { hasRole } = useRole();
  const canManage = hasRole("HEAD");
  const [rows, setRows] = useState<Swap[]>([]);
  const [staff, setStaff] = useState<StaffOpt[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [showAll, setShowAll] = useState(false);

  const load = async () => {
    setLoading(true);
    let q = db.from("shift_swap_requests")
      .select("*, requester:profiles!shift_swap_requests_requester_id_fkey(full_name, staff_id), target:profiles!shift_swap_requests_target_id_fkey(full_name, staff_id)")
      .order("created_at", { ascending: false });
    if (!showAll) q = q.eq("status", "pending");
    const { data, error } = await q;
    if (error) toast.error(error.message);
    setRows((data as Swap[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    supabase.from("profiles").select("id, full_name, staff_id").eq("is_active", true).order("full_name")
      .then(({ data }) => setStaff((data as StaffOpt[]) || []));
  }, []);

  useEffect(() => { load(); }, [showAll]);

  const submit = async () => {
    if (!form.target_id || !form.requester_date || !form.target_date)
      return toast.error("Target and both dates are required");
    if (form.target_id === user!.id) return toast.error("Cannot swap with yourself");
    const { error } = await db.from("shift_swap_requests").insert({
      requester_id: user!.id,
      target_id: form.target_id,
      requester_date: form.requester_date,
      target_date: form.target_date,
      requester_shift: form.requester_shift.trim() || null,
      target_shift: form.target_shift.trim() || null,
      reason: form.reason.trim() || null,
      status: "pending",
    });
    if (error) return toast.error(error.message);
    toast.success("Swap request submitted");
    setOpen(false); setForm(empty); load();
  };

  const review = async (id: string, status: "approved" | "rejected") => {
    const { error } = await db.from("shift_swap_requests").update({
      status, reviewed_by: user!.id, reviewed_at: new Date().toISOString(),
    }).eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success(`Swap ${status}`); load(); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Shift Swaps</h1>
          <p className="text-muted-foreground">Request and manage shift swap requests.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowAll(!showAll)}>
            {showAll ? "Pending only" : "Show history"}
          </Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" />New Swap</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Request Shift Swap</DialogTitle></DialogHeader>
              <div className="grid gap-3 py-2">
                <div>
                  <Label>Swap with</Label>
                  <Select value={form.target_id} onValueChange={(v) => setForm({ ...form, target_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Select staff" /></SelectTrigger>
                    <SelectContent>
                      {staff.filter((s) => s.id !== user?.id).map((s) => (
                        <SelectItem key={s.id} value={s.id}>{s.full_name} ({s.staff_id})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Your date</Label><Input type="date" value={form.requester_date} onChange={(e) => setForm({ ...form, requester_date: e.target.value })} /></div>
                  <div><Label>Their date</Label><Input type="date" value={form.target_date} onChange={(e) => setForm({ ...form, target_date: e.target.value })} /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Your shift</Label><Input value={form.requester_shift} onChange={(e) => setForm({ ...form, requester_shift: e.target.value })} placeholder="e.g. Morning" /></div>
                  <div><Label>Their shift</Label><Input value={form.target_shift} onChange={(e) => setForm({ ...form, target_shift: e.target.value })} placeholder="e.g. Night" /></div>
                </div>
                <div><Label>Reason</Label><Textarea value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} /></div>
              </div>
              <DialogFooter><Button onClick={submit}>Submit</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><ArrowLeftRight className="h-5 w-5" />{showAll ? "All requests" : "Pending"}</CardTitle>
          <CardDescription>{rows.length} request{rows.length !== 1 ? "s" : ""}</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Requester</TableHead>
                  <TableHead>Target</TableHead>
                  <TableHead>Dates</TableHead>
                  <TableHead>Shifts</TableHead>
                  <TableHead>Status</TableHead>
                  {canManage && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No requests.</TableCell></TableRow>
                ) : rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <div className="font-medium">{r.requester?.full_name}</div>
                      <div className="text-xs text-muted-foreground">{format(new Date(r.requester_date + "T00:00:00"), "dd MMM")}</div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{r.target?.full_name}</div>
                      <div className="text-xs text-muted-foreground">{format(new Date(r.target_date + "T00:00:00"), "dd MMM")}</div>
                    </TableCell>
                    <TableCell className="text-sm">{r.requester_date} ↔ {r.target_date}</TableCell>
                    <TableCell className="text-sm">{r.requester_shift || "—"} ↔ {r.target_shift || "—"}</TableCell>
                    <TableCell><Badge variant="outline">{r.status}</Badge></TableCell>
                    {canManage && (
                      <TableCell className="text-right space-x-1">
                        {r.status === "pending" && (
                          <>
                            <Button size="sm" variant="ghost" onClick={() => review(r.id, "approved")}>Approve</Button>
                            <Button size="sm" variant="ghost" onClick={() => review(r.id, "rejected")}>Reject</Button>
                          </>
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
