import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { FileText, Loader2, Printer, Download } from "lucide-react";
import { downloadPayslipPdf } from "@/lib/payslipPdf";

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const fmt = (n: number | null | undefined) =>
  n == null ? "—" : `KES ${Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

interface PayslipRun {
  id: string;
  gross_earnings: number | null;
  total_deductions: number | null;
  net_pay: number | null;
  is_included: boolean;
  period?: { period_year: number; period_month: number; status: string };
}
interface LineItem { id: string; kind: string; code: string; label: string; amount: number }

export default function MyPayslips() {
  const { user, profile } = useAuth();
  const [runs, setRuns] = useState<PayslipRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<PayslipRun | null>(null);
  const [items, setItems] = useState<LineItem[]>([]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data, error } = await supabase
        .from("payroll_runs")
        .select("id, gross_earnings, total_deductions, net_pay, is_included, period:payroll_periods(period_year, period_month, status)")
        .eq("employee_id", user.id)
        .order("created_at", { ascending: false });
      if (error) toast.error(error.message);
      setRuns((data as PayslipRun[]) || []);
      setLoading(false);
    })();
  }, [user]);

  const open = async (run: PayslipRun) => {
    const { data } = await supabase.from("payroll_line_items").select("*").eq("run_id", run.id).order("kind");
    setItems((data as LineItem[]) || []);
    setSelected(run);
  };

  const periodLabel = (r: PayslipRun) =>
    r.period ? `${MONTHS[r.period.period_month - 1]} ${r.period.period_year}` : "—";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">My Payslips</h1>
        <p className="text-muted-foreground">View, print, or download PDF payslips.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5" />Payslips</CardTitle>
          <CardDescription>{runs.length} record{runs.length !== 1 ? "s" : ""}</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Period</TableHead>
                  <TableHead>Gross</TableHead>
                  <TableHead>Deductions</TableHead>
                  <TableHead>Net</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {runs.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No payslips yet.</TableCell></TableRow>
                ) : runs.map((r) => (
                  <TableRow key={r.id} className="cursor-pointer hover:bg-muted/50" onClick={() => open(r)}>
                    <TableCell className="font-medium">{periodLabel(r)}</TableCell>
                    <TableCell>{fmt(r.gross_earnings)}</TableCell>
                    <TableCell>{fmt(r.total_deductions)}</TableCell>
                    <TableCell className="font-medium">{fmt(r.net_pay)}</TableCell>
                    <TableCell><Badge variant="outline">{r.period?.status ?? (r.is_included ? "INCLUDED" : "EXCLUDED")}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-lg print:shadow-none">
          <DialogHeader>
            <DialogTitle>Payslip — {selected && periodLabel(selected)}</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4" id="payslip-print">
              <div className="text-sm space-y-1">
                <div><span className="text-muted-foreground">Employee:</span> {profile?.full_name}</div>
                <div><span className="text-muted-foreground">Staff ID:</span> {profile?.staff_id}</div>
              </div>
              <div className="grid grid-cols-3 gap-2 text-sm">
                <div><div className="text-muted-foreground">Gross</div><div className="font-medium">{fmt(selected.gross_earnings)}</div></div>
                <div><div className="text-muted-foreground">Deductions</div><div className="font-medium">{fmt(selected.total_deductions)}</div></div>
                <div><div className="text-muted-foreground">Net</div><div className="font-medium">{fmt(selected.net_pay)}</div></div>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead>Kind</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((i) => (
                    <TableRow key={i.id}>
                      <TableCell>{i.label || i.code}</TableCell>
                      <TableCell><Badge variant="outline">{i.kind}</Badge></TableCell>
                      <TableCell className="text-right">{fmt(i.amount)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="flex gap-2 print:hidden">
                <Button
                  variant="outline"
                  onClick={async () => {
                    if (!selected) return;
                    try {
                      await downloadPayslipPdf({
                      periodLabel: periodLabel(selected),
                      employeeName: profile?.full_name || "Employee",
                      staffId: profile?.staff_id,
                      kraPin: (profile as any)?.kra_pin,
                      bankName: (profile as any)?.bank_name,
                      bankAccount: (profile as any)?.bank_account,
                      grossEarnings: selected.gross_earnings,
                      totalDeductions: selected.total_deductions,
                      netPay: selected.net_pay,
                      items,
                    });
                      toast.success("Payslip PDF downloaded");
                    } catch {
                      toast.error("Could not generate payslip PDF");
                    }
                  }}
                >
                  <Download className="h-4 w-4 mr-2" />Download PDF
                </Button>
                <Button onClick={() => window.print()}>
                  <Printer className="h-4 w-4 mr-2" />Print
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
