import React, { useCallback, useEffect, useState } from 'react';
import { Link, useParams, Navigate } from 'react-router-dom';
import { useRole } from '@/hooks/useRole';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ArrowLeft, Lock, ShieldAlert, Play, CheckCircle2, Calculator, Download, Loader2, Printer } from 'lucide-react';
import { toast } from 'sonner';
import type { PayrollPeriodStatus } from '@/types/database';
import { downloadPayslipPdf, periodLabelFrom } from '@/lib/payslipPdf';

interface Period {
  id: string; period_year: number; period_month: number; status: PayrollPeriodStatus;
  hr_reviewed_by: string | null; finance_approved_by: string | null; locked_by: string | null;
}
interface Run {
  id: string; employee_id: string; basic_salary: number | null; gross_earnings: number | null;
  total_deductions: number | null; net_pay: number | null; attendance_json: any;
  is_included?: boolean; exclusion_reason?: string | null;
  employee?: {
    full_name: string; staff_id: string; kra_pin?: string;
    bank_name?: string; bank_branch?: string; bank_account?: string;
    nssf_number?: string; shif_number?: string;
  };
}
interface LineItem { id: string; kind: string; code: string; label: string; amount: number }
interface Readiness {
  ready: boolean; message: string; pending_ot_days: number;
  pending_attendance_days: number; open_blocker_exceptions: number; open_ot_exceptions: number;
}

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const fmt = (n: number | null | undefined) => n == null ? '—' : `KES ${Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function PayrollPeriod() {
  const { periodId } = useParams();
  const { canViewPayroll, isFinanceAdmin, isSuperAdmin, hasRole } = useRole();
  const { user } = useAuth();
  const [period, setPeriod] = useState<Period | null>(null);
  const [runs, setRuns] = useState<Run[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [payslipRun, setPayslipRun] = useState<Run | null>(null);
  const [payslipItems, setPayslipItems] = useState<LineItem[]>([]);
  const [readiness, setReadiness] = useState<Readiness | null>(null);
  const [staffGaps, setStaffGaps] = useState<{ id: string; staff_id: string; full_name: string; gaps: string[] }[]>([]);

  const load = useCallback(async () => {
    if (!periodId) return;
    setLoading(true);
    const { data: p } = await supabase.from('payroll_periods').select('*').eq('id', periodId).maybeSingle();
    const { data: r } = await supabase.from('payroll_runs')
      .select('*, employee:profiles!payroll_runs_employee_id_fkey(full_name, staff_id, kra_pin, bank_name, bank_branch, bank_account, nssf_number, shif_number)')
      .eq('period_id', periodId).order('created_at');
    setPeriod(p as Period | null);
    setRuns((r as any[]) || []);
    if (periodId) {
      const { data: ready } = await (supabase as any).rpc('attendance_payroll_readiness', { _period_id: periodId });
      setReadiness(ready as Readiness | null);
    }
    const { data: staff } = await supabase
      .from('profiles')
      .select('id, staff_id, full_name, kra_pin, basic_salary, bank_name, bank_account, nssf_number, shif_number')
      .eq('hr_status', 'ACTIVE');
    setStaffGaps(
      ((staff as any[]) || [])
        .map((row) => {
          const gaps: string[] = [];
          if (!row.kra_pin) gaps.push('KRA');
          if (!row.basic_salary) gaps.push('Salary');
          if (!row.bank_name || !row.bank_account) gaps.push('Bank');
          if (!row.nssf_number) gaps.push('NSSF');
          if (!row.shif_number) gaps.push('SHIF');
          return { id: row.id, staff_id: row.staff_id, full_name: row.full_name, gaps };
        })
        .filter((row) => row.gaps.length > 0)
    );
    setLoading(false);
  }, [periodId]);

  useEffect(() => { load(); }, [load]);

  if (!canViewPayroll) return <Navigate to="/dashboard" replace />;
  if (loading) return <div className="p-6 text-muted-foreground">Loading…</div>;
  if (!period) return <div className="p-6">Period not found.</div>;

  const setStatus = async (next: PayrollPeriodStatus, label: string) => {
    setBusy(next);
    const { error } = await supabase.from('payroll_periods').update({ status: next }).eq('id', period.id);
    setBusy(null);
    if (error) toast.error(`${label} failed: ${error.message}`);
    else { toast.success(`${label} complete`); load(); }
  };

  const runCalculation = async () => {
    setBusy('calc');
    const { data, error } = await supabase.rpc('calculate_payroll', { _period_id: period.id });
    setBusy(null);
    if (error) { toast.error(error.message); return; }
    const res: any = data;
    if (res?.status === 'missing_data') {
      toast.error(`Missing KRA PIN / Basic Salary for ${res.missing.length} staff. Fix in Staff Compliance and retry.`);
    } else if (res?.status === 'ok') {
      toast.success(`Payroll calculated for ${res.runs} employees`);
    }
    load();
  };

  const openPayslip = async (run: Run) => {
    const { data } = await supabase.from('payroll_line_items').select('*').eq('run_id', run.id).order('kind');
    setPayslipItems((data as LineItem[]) || []);
    setPayslipRun(run);
  };

  const exportBankCsv = () => {
    const included = runs.filter((r) => r.is_included !== false);
    if (included.length === 0) { toast.error('No included runs to export'); return; }
    const missingBank = included.filter((r) => !r.employee?.bank_name || !r.employee?.bank_account);
    if (missingBank.length > 0) {
      toast.error(`${missingBank.length} staff missing bank name/account — fix in Staff Compliance before export`);
      return;
    }
    const header = ['Staff ID','Name','Bank','Branch','Account','Amount','Reference'];
    const ref = `SAL-${period.period_year}-${String(period.period_month).padStart(2,'0')}`;
    const rows = included.map(r => [
      r.employee?.staff_id ?? '', r.employee?.full_name ?? '',
      r.employee?.bank_name ?? '', r.employee?.bank_branch ?? '', r.employee?.bank_account ?? '',
      (r.net_pay ?? 0).toFixed(2), ref
    ]);
    const csv = [header, ...rows].map(row => row.map(c => `"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `bank-export-${ref}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast.success('Bank CSV downloaded');
  };

  const exportStatutoryCsv = async (kind: 'PAYE' | 'NSSF' | 'SHIF' | 'HOUSING') => {
    const included = runs.filter((r) => r.is_included !== false);
    if (included.length === 0) { toast.error('No included runs to export'); return; }
    const { data: items } = await supabase
      .from('payroll_line_items')
      .select('run_id, code, amount')
      .in('run_id', included.map((r) => r.id));
    const byRun = new Map<string, Record<string, number>>();
    (items || []).forEach((i: any) => {
      const m = byRun.get(i.run_id) || {};
      m[i.code] = Number(i.amount) || 0;
      byRun.set(i.run_id, m);
    });
    const ref = `${kind}-${period.period_year}-${String(period.period_month).padStart(2, '0')}`;
    let header: string[];
    let rows: (string | number)[][];
    if (kind === 'PAYE') {
      header = ['Staff ID', 'Name', 'KRA PIN', 'Gross', 'PAYE', 'Period'];
      rows = included.map((r) => {
        const m = byRun.get(r.id) || {};
        return [r.employee?.staff_id ?? '', r.employee?.full_name ?? '', r.employee?.kra_pin ?? '',
          (r.gross_earnings ?? 0).toFixed(2), (m.PAYE ?? 0).toFixed(2), ref];
      });
    } else if (kind === 'NSSF') {
      header = ['Staff ID', 'Name', 'NSSF Number', 'NSSF Employee', 'NSSF Employer', 'Period'];
      rows = included.map((r) => {
        const m = byRun.get(r.id) || {};
        return [r.employee?.staff_id ?? '', r.employee?.full_name ?? '', r.employee?.nssf_number ?? '',
          (m.NSSF ?? 0).toFixed(2), (m.NSSF_ER ?? 0).toFixed(2), ref];
      });
    } else if (kind === 'SHIF') {
      header = ['Staff ID', 'Name', 'SHIF Number', 'SHIF', 'Period'];
      rows = included.map((r) => {
        const m = byRun.get(r.id) || {};
        return [r.employee?.staff_id ?? '', r.employee?.full_name ?? '', r.employee?.shif_number ?? '',
          (m.SHIF ?? 0).toFixed(2), ref];
      });
    } else {
      header = ['Staff ID', 'Name', 'KRA PIN', 'Housing Employee', 'Housing Employer', 'Period'];
      rows = included.map((r) => {
        const m = byRun.get(r.id) || {};
        return [r.employee?.staff_id ?? '', r.employee?.full_name ?? '', r.employee?.kra_pin ?? '',
          (m.HOUSING ?? 0).toFixed(2), (m.HOUSING_ER ?? 0).toFixed(2), ref];
      });
    }
    const csv = [header, ...rows].map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${kind.toLowerCase()}-report-${ref}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast.success(`${kind} report downloaded`);
  };

  const toggleIncluded = async (run: Run) => {
    const next = !(run.is_included !== false);
    const { error } = await supabase.from('payroll_runs').update({
      is_included: next,
      exclusion_reason: next ? null : 'Excluded by finance/HR',
    } as any).eq('id', run.id);
    if (error) toast.error(error.message);
    else { toast.success(next ? 'Included in pay' : 'Excluded from pay'); load(); }
  };

  const s = period.status;
  const isHrAdmin = hasRole('ADMIN');
  const canLockAtt = isHrAdmin && s === 'DRAFT';
  const canCalc = isHrAdmin && (s === 'ATTENDANCE_LOCKED' || s === 'CALCULATED');
  const canHrReview = isHrAdmin && s === 'CALCULATED';
  const canFinanceApprove = isFinanceAdmin && s === 'HR_REVIEWED' && period.hr_reviewed_by !== user?.id;
  const canLock = isSuperAdmin && s === 'FINANCE_APPROVED';
  const canExport = (isFinanceAdmin || isSuperAdmin) && (s === 'FINANCE_APPROVED' || s === 'LOCKED');

  const totalNet = runs.filter(r => r.is_included !== false).reduce((sum, r) => sum + (Number(r.net_pay) || 0), 0);
  const totalGross = runs.filter(r => r.is_included !== false).reduce((sum, r) => sum + (Number(r.gross_earnings) || 0), 0);

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link to="/payroll"><ArrowLeft className="mr-2 h-4 w-4" /> Back</Link>
        </Button>
      </div>
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            {MONTHS[period.period_month - 1]} {period.period_year}
            <Badge>{s.replace(/_/g, ' ')}</Badge>
          </h1>
          <p className="text-muted-foreground">Kenya PAYE • NSSF • SHIF • Housing Levy — audited workflow.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {canLockAtt && (
            <Button onClick={() => setStatus('ATTENDANCE_LOCKED', 'Lock attendance')} disabled={!!busy}>
              {busy === 'ATTENDANCE_LOCKED' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <Lock className="mr-2 h-4 w-4" /> Lock Attendance
            </Button>
          )}
          {canCalc && (
            <Button onClick={runCalculation} disabled={!!busy}>
              {busy === 'calc' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Calculator className="mr-2 h-4 w-4" />}
              Run Calculation
            </Button>
          )}
          {canHrReview && (
            <Button variant="secondary" onClick={() => setStatus('HR_REVIEWED', 'HR Review')} disabled={!!busy}>
              <CheckCircle2 className="mr-2 h-4 w-4" /> HR Review
            </Button>
          )}
          {canFinanceApprove && (
            <Button onClick={() => setStatus('FINANCE_APPROVED', 'Finance Approval')} disabled={!!busy}>
              <ShieldAlert className="mr-2 h-4 w-4" /> Finance Approve
            </Button>
          )}
          {canLock && (
            <Button variant="destructive" onClick={() => setStatus('LOCKED', 'Finalise')} disabled={!!busy}>
              <Lock className="mr-2 h-4 w-4" /> Finalise (Lock)
            </Button>
          )}
          {canExport && (
            <>
              <Button variant="outline" onClick={exportBankCsv}>
                <Download className="mr-2 h-4 w-4" /> Bank CSV
              </Button>
              <Button variant="outline" onClick={() => exportStatutoryCsv('PAYE')}>PAYE</Button>
              <Button variant="outline" onClick={() => exportStatutoryCsv('NSSF')}>NSSF</Button>
              <Button variant="outline" onClick={() => exportStatutoryCsv('SHIF')}>SHIF</Button>
              <Button variant="outline" onClick={() => exportStatutoryCsv('HOUSING')}>Housing</Button>
            </>
          )}
        </div>
      </div>

      {s === 'DRAFT' && readiness && !readiness.ready && (
        <Alert variant="destructive">
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>Cannot lock attendance yet</AlertTitle>
          <AlertDescription className="space-y-1">
            <p>{readiness.message}</p>
            <p className="text-sm">
              Pending OT days: {readiness.pending_ot_days} · Open blockers: {readiness.open_blocker_exceptions} ·{' '}
              <Link className="underline" to="/attendance/overtime">Open OT Approvals</Link>
            </p>
          </AlertDescription>
        </Alert>
      )}
      {s === 'DRAFT' && readiness?.ready && (
        <Alert>
          <CheckCircle2 className="h-4 w-4" />
          <AlertTitle>Attendance ready</AlertTitle>
          <AlertDescription>No unapproved OT or blocker exceptions for this period.</AlertDescription>
        </Alert>
      )}

      {staffGaps.length > 0 && (s === 'DRAFT' || s === 'ATTENDANCE_LOCKED' || s === 'CALCULATED') && (
        <Alert>
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>Payroll data gaps — {staffGaps.length} active staff</AlertTitle>
          <AlertDescription className="space-y-2">
            <p>KRA + basic salary are required to calculate. Bank / NSSF / SHIF are required for clean exports.</p>
            <div className="text-sm max-h-28 overflow-auto">
              {staffGaps.slice(0, 12).map((g) => (
                <div key={g.id}>{g.staff_id} {g.full_name}: {g.gaps.join(', ')}</div>
              ))}
              {staffGaps.length > 12 && <div>…and {staffGaps.length - 12} more</div>}
            </div>
            <Link className="underline text-sm" to="/staff/compliance">Fix in Staff Compliance</Link>
          </AlertDescription>
        </Alert>
      )}

      {s === 'HR_REVIEWED' && isFinanceAdmin && period.hr_reviewed_by === user?.id && (
        <Alert variant="destructive">
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>Segregation of duties</AlertTitle>
          <AlertDescription>You were the HR reviewer, so you cannot approve as Finance. A different FINANCE_ADMIN must approve.</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="Employees" value={String(runs.length)} />
        <StatCard label="Total Gross" value={fmt(totalGross)} />
        <StatCard label="Total Net" value={fmt(totalNet)} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Payroll Runs</CardTitle>
          <CardDescription>Click a row for its payslip breakdown.</CardDescription>
        </CardHeader>
        <CardContent>
          {runs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No runs yet. Lock attendance, then run calculation.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Staff ID</TableHead><TableHead>Name</TableHead>
                  <TableHead className="text-right">Basic</TableHead>
                  <TableHead className="text-right">Gross</TableHead>
                  <TableHead className="text-right">Deductions</TableHead>
                  <TableHead className="text-right">Net Pay</TableHead>
                  <TableHead>Pay</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {runs.map((r) => (
                  <TableRow key={r.id} className={`cursor-pointer ${r.is_included === false ? 'opacity-50' : ''}`} onClick={() => openPayslip(r)}>
                    <TableCell>{r.employee?.staff_id}</TableCell>
                    <TableCell>{r.employee?.full_name}</TableCell>
                    <TableCell className="text-right">{fmt(r.basic_salary)}</TableCell>
                    <TableCell className="text-right">{fmt(r.gross_earnings)}</TableCell>
                    <TableCell className="text-right">{fmt(r.total_deductions)}</TableCell>
                    <TableCell className="text-right font-semibold">{fmt(r.net_pay)}</TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      {(isFinanceAdmin || isHrAdmin || isSuperAdmin) && s !== 'LOCKED' ? (
                        <Button size="sm" variant="ghost" onClick={() => toggleIncluded(r)}>
                          {r.is_included === false ? 'Include' : 'Exclude'}
                        </Button>
                      ) : (
                        <Badge variant="outline">{r.is_included === false ? 'Excluded' : 'Included'}</Badge>
                      )}
                    </TableCell>
                    <TableCell><Button size="sm" variant="ghost">View</Button></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!payslipRun} onOpenChange={(o) => !o && setPayslipRun(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Payslip — {payslipRun?.employee?.full_name}</DialogTitle>
          </DialogHeader>
          {payslipRun && (
            <div className="space-y-4 print:p-6" id="payslip-body">
              <div className="text-sm text-muted-foreground">
                {MONTHS[period.period_month - 1]} {period.period_year} • Staff ID {payslipRun.employee?.staff_id} • KRA {payslipRun.employee?.kra_pin || '—'}
              </div>
              <PayslipSection title="Earnings" items={payslipItems.filter(i => i.kind === 'EARNING')} />
              <PayslipSection title="Deductions" items={payslipItems.filter(i => i.kind === 'DEDUCTION')} />
              <PayslipSection title="Employer Contributions" items={payslipItems.filter(i => i.kind === 'EMPLOYER_CONTRIB')} />
              <div className="flex justify-between border-t pt-3 text-lg font-bold">
                <span>Net Pay</span><span>{fmt(payslipRun.net_pay)}</span>
              </div>
              <div className="flex justify-end gap-2 print:hidden">
                <Button
                  variant="outline"
                  onClick={async () => {
                    if (!payslipRun) return;
                    try {
                      await downloadPayslipPdf({
                      periodLabel: periodLabelFrom(period.period_year, period.period_month),
                      employeeName: payslipRun.employee?.full_name || 'Employee',
                      staffId: payslipRun.employee?.staff_id,
                      kraPin: payslipRun.employee?.kra_pin,
                      bankName: payslipRun.employee?.bank_name,
                      bankAccount: payslipRun.employee?.bank_account,
                      grossEarnings: payslipRun.gross_earnings,
                      totalDeductions: payslipRun.total_deductions,
                      netPay: payslipRun.net_pay,
                      items: payslipItems,
                    });
                      toast.success('Payslip PDF downloaded');
                    } catch {
                      toast.error('Could not generate payslip PDF');
                    }
                  }}
                >
                  <Download className="mr-2 h-4 w-4" /> Download PDF
                </Button>
                <Button variant="outline" onClick={() => window.print()}>
                  <Printer className="mr-2 h-4 w-4" /> Print
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardHeader className="pb-2"><CardDescription>{label}</CardDescription></CardHeader>
      <CardContent><div className="text-2xl font-bold">{value}</div></CardContent>
    </Card>
  );
}

function PayslipSection({ title, items }: { title: string; items: LineItem[] }) {
  if (items.length === 0) return null;
  const total = items.reduce((s, i) => s + Number(i.amount), 0);
  return (
    <div>
      <div className="font-semibold mb-1">{title}</div>
      <div className="space-y-1 text-sm">
        {items.map(i => (
          <div key={i.id} className="flex justify-between">
            <span>{i.label}</span><span>{fmt(i.amount)}</span>
          </div>
        ))}
        <div className="flex justify-between font-medium border-t pt-1">
          <span>Total {title}</span><span>{fmt(total)}</span>
        </div>
      </div>
    </div>
  );
}
