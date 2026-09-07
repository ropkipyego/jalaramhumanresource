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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Coins, Loader2, Plus } from "lucide-react";

const db = supabase as any;

interface EncashRow {
  id: string;
  employee_id: string;
  year: number;
  days: number;
  amount: number | null;
  status: string;
  notes: string | null;
  created_at: string;
  employee?: { full_name: string; staff_id: string };
}

export default function LeaveEncashment() {
  const { user } = useAuth();
  const { hasRole, canViewPayroll } = useRole();
  const canManage = canViewPayroll || hasRole("ADMIN");
  const [rows, setRows] = useState<EncashRow[]>([]);
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [days, setDays] = useState("");
  const [notes, setNotes] = useState("");

  const year = new Date().getFullYear();

  const load = async () => {
    setLoading(true);
    let q = db.from("leave_encashment_requests")
      .select("*, employee:profiles!leave_encashment_requests_employee_id_fkey(full_name, staff_id)")
      .order("created_at", { ascending: false });
    if (!canManage && user) q = q.eq("employee_id", user.id);
    const { data, error } = await q;
    if (error) toast.error(error.message);
    setRows((data as EncashRow[]) || []);

    if (user) {
      const { data: ent } = await db.from("leave_entitlements")
        .select("annual_days, used_days, carried_forward")
        .eq("employee_id", user.id).eq("year", year).maybeSingle();
      if (ent) {
        setBalance(Number(ent.annual_days) - Number(ent.used_days) + Number(ent.carried_forward || 0));
      } else setBalance(0);
    }
    setLoading(false);
  };

  useEffect(() => { if (user) load(); }, [user, canManage]);

  const submit = async () => {
    const d = Number(days);
    if (!d || d <= 0) return toast.error("Enter days to encash");
    if (d > balance) return toast.error("Insufficient leave balance");
    const { error } = await db.from("leave_encashment_requests").insert({
      employee_id: user!.id, year, days: d, notes: notes.trim() || null, status: "pending",
    });
    if (error) return toast.error(error.message);
    toast.success("Encashment request submitted");
    setOpen(false); setDays(""); setNotes(""); load();
  };

  const review = async (id: string, status: "approved" | "rejected") => {
    const { error } = await db.from("leave_encashment_requests").update({
      status, reviewed_by: user!.id, reviewed_at: new Date().toISOString(),
    }).eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success(`Request ${status}`); load(); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Leave Encashment</h1>
          <p className="text-muted-foreground">Request payment for unused annual leave days.</p>
        </div>
        {!canManage && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" />Request Encashment</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>New Encashment Request</DialogTitle></DialogHeader>
              <div className="grid gap-3 py-2">
                <p className="text-sm text-muted-foreground">Available balance ({year}): <strong>{balance}</strong> days</p>
                <div><Label>Days</Label><Input type="number" min={0.5} step={0.5} value={days} onChange={(e) => setDays(e.target.value)} /></div>
                <div><Label>Notes</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
              </div>
              <DialogFooter><Button onClick={submit}>Submit</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {!canManage && (
        <Card>
          <CardContent className="pt-6 flex items-center gap-3">
            <Coins className="h-8 w-8 text-primary" />
            <div>
              <div className="text-2xl font-bold">{balance}</div>
              <div className="text-sm text-muted-foreground">Leave days available ({year})</div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Requests</CardTitle>
          <CardDescription>{canManage ? "All encashment requests" : "Your requests"}</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  {canManage && <TableHead>Employee</TableHead>}
                  <TableHead>Year</TableHead>
                  <TableHead>Days</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Notes</TableHead>
                  {canManage && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No requests.</TableCell></TableRow>
                ) : rows.map((r) => (
                  <TableRow key={r.id}>
                    {canManage && (
                      <TableCell>
                        <div className="font-medium">{r.employee?.full_name}</div>
                        <div className="text-xs text-muted-foreground">{r.employee?.staff_id}</div>
                      </TableCell>
                    )}
                    <TableCell>{r.year}</TableCell>
                    <TableCell>{r.days}</TableCell>
                    <TableCell><Badge variant="outline">{r.status}</Badge></TableCell>
                    <TableCell className="text-sm max-w-[200px] truncate">{r.notes || "—"}</TableCell>
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
