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
import { Banknote, Loader2, Plus } from "lucide-react";

const db = supabase as any;
const fmt = (n: number | null | undefined) =>
  n == null ? "—" : `KES ${Number(n).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

interface Loan {
  id: string;
  employee_id: string;
  loan_type: string;
  principal: number;
  monthly_deduction: number;
  balance: number;
  status: string;
  reason: string | null;
  created_at: string;
  employee?: { full_name: string; staff_id: string };
}
interface Repayment { id: string; amount: number; paid_at: string; notes: string | null }

const empty = { loan_type: "SALARY_ADVANCE", principal: "", monthly_deduction: "", reason: "" };

export default function LoansAdvances() {
  const { user } = useAuth();
  const { canViewPayroll, hasRole } = useRole();
  const canManage = canViewPayroll || hasRole("ADMIN");
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [detail, setDetail] = useState<Loan | null>(null);
  const [repayments, setRepayments] = useState<Repayment[]>([]);

  const load = async () => {
    setLoading(true);
    let q = db.from("employee_loans")
      .select("*, employee:profiles!employee_loans_employee_id_fkey(full_name, staff_id)")
      .order("created_at", { ascending: false });
    if (!canManage && user) q = q.eq("employee_id", user.id);
    const { data, error } = await q;
    if (error) toast.error(error.message);
    setLoans((data as Loan[]) || []);
    setLoading(false);
  };

  useEffect(() => { if (user) load(); }, [user, canManage]);

  const submit = async () => {
    const principal = Number(form.principal);
    const monthly = Number(form.monthly_deduction);
    if (!principal || principal <= 0) return toast.error("Enter principal amount");
    if (!monthly || monthly <= 0) return toast.error("Enter monthly deduction");
    const { error } = await db.from("employee_loans").insert({
      employee_id: user!.id,
      loan_type: form.loan_type,
      principal,
      monthly_deduction: monthly,
      balance: principal,
      reason: form.reason.trim() || null,
      status: "PENDING",
    });
    if (error) return toast.error(error.message);
    toast.success("Loan request submitted");
    setOpen(false); setForm(empty); load();
  };

  const review = async (id: string, status: "ACTIVE" | "REJECTED") => {
    const { error } = await db.from("employee_loans").update({
      status, approved_by: user!.id, approved_at: new Date().toISOString(),
    }).eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success(status === "ACTIVE" ? "Loan approved" : "Loan rejected"); load(); }
  };

  const openDetail = async (loan: Loan) => {
    setDetail(loan);
    const { data } = await db.from("loan_repayments").select("*").eq("loan_id", loan.id).order("paid_at", { ascending: false });
    setRepayments((data as Repayment[]) || []);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Loans & Advances</h1>
          <p className="text-muted-foreground">Salary advances, emergency loans, and staff loans.</p>
        </div>
        {!canManage && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" />New Request</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Request Loan / Advance</DialogTitle></DialogHeader>
              <div className="grid gap-3 py-2">
                <div>
                  <Label>Type</Label>
                  <Select value={form.loan_type} onValueChange={(v) => setForm({ ...form, loan_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="SALARY_ADVANCE">Salary Advance</SelectItem>
                      <SelectItem value="EMERGENCY">Emergency</SelectItem>
                      <SelectItem value="STAFF_LOAN">Staff Loan</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Principal (KES)</Label><Input type="number" value={form.principal} onChange={(e) => setForm({ ...form, principal: e.target.value })} /></div>
                <div><Label>Monthly Deduction (KES)</Label><Input type="number" value={form.monthly_deduction} onChange={(e) => setForm({ ...form, monthly_deduction: e.target.value })} /></div>
                <div><Label>Reason</Label><Textarea value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} /></div>
              </div>
              <DialogFooter><Button onClick={submit}>Submit</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Banknote className="h-5 w-5" />Loans</CardTitle>
          <CardDescription>{loans.length} record{loans.length !== 1 ? "s" : ""}</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  {canManage && <TableHead>Employee</TableHead>}
                  <TableHead>Type</TableHead>
                  <TableHead>Principal</TableHead>
                  <TableHead>Balance</TableHead>
                  <TableHead>Monthly</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loans.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No loans.</TableCell></TableRow>
                ) : loans.map((l) => (
                  <TableRow key={l.id}>
                    {canManage && (
                      <TableCell>
                        <div className="font-medium">{l.employee?.full_name}</div>
                        <div className="text-xs text-muted-foreground">{l.employee?.staff_id}</div>
                      </TableCell>
                    )}
                    <TableCell>{l.loan_type.replace(/_/g, " ")}</TableCell>
                    <TableCell>{fmt(l.principal)}</TableCell>
                    <TableCell>{fmt(l.balance)}</TableCell>
                    <TableCell>{fmt(l.monthly_deduction)}</TableCell>
                    <TableCell><Badge variant="outline">{l.status}</Badge></TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button size="sm" variant="ghost" onClick={() => openDetail(l)}>History</Button>
                      {canManage && l.status === "PENDING" && (
                        <>
                          <Button size="sm" variant="ghost" onClick={() => review(l.id, "ACTIVE")}>Approve</Button>
                          <Button size="sm" variant="ghost" onClick={() => review(l.id, "REJECTED")}>Reject</Button>
                        </>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Repayment History</DialogTitle>
          </DialogHeader>
          {detail && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {detail.loan_type.replace(/_/g, " ")} · Balance {fmt(detail.balance)} · {detail.reason || "No reason"}
              </p>
              {repayments.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">No repayments recorded yet.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Notes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {repayments.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell>{format(new Date(r.paid_at), "dd MMM yyyy")}</TableCell>
                        <TableCell>{fmt(r.amount)}</TableCell>
                        <TableCell className="text-sm">{r.notes || "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
