import React, { useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useRole } from '@/hooks/useRole';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { Calculator, Plus, Lock, ShieldAlert } from 'lucide-react';
import type { PayrollPeriodStatus } from '@/types/database';

interface PayrollPeriod {
  id: string;
  period_year: number;
  period_month: number;
  status: PayrollPeriodStatus;
  created_at: string;
}

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const STATUS_STYLES: Record<PayrollPeriodStatus, string> = {
  DRAFT: 'bg-muted text-muted-foreground',
  ATTENDANCE_LOCKED: 'bg-[hsl(var(--info))] text-[hsl(var(--info-foreground))]',
  CALCULATED: 'bg-[hsl(var(--info))] text-[hsl(var(--info-foreground))]',
  HR_REVIEWED: 'bg-[hsl(var(--warning))] text-[hsl(var(--warning-foreground))]',
  FINANCE_APPROVED: 'bg-primary text-primary-foreground',
  LOCKED: 'bg-destructive text-destructive-foreground',
};

export default function Payroll() {
  const { canViewPayroll, isAdmin, isSuperAdmin } = useRole();
  const [periods, setPeriods] = useState<PayrollPeriod[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const now = new Date();
  const [year, setYear] = useState<number>(now.getFullYear());
  const [month, setMonth] = useState<number>(now.getMonth() + 1);
  const [creating, setCreating] = useState(false);

  const canCreate = isAdmin || isSuperAdmin;

  const fetchPeriods = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('payroll_periods')
      .select('id, period_year, period_month, status, created_at')
      .order('period_year', { ascending: false })
      .order('period_month', { ascending: false });
    if (error) toast.error(error.message);
    setPeriods((data as PayrollPeriod[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    if (canViewPayroll) fetchPeriods();
  }, [canViewPayroll]);

  const years = useMemo(() => {
    const y = now.getFullYear();
    return [y - 1, y, y + 1];
  }, []);

  if (!canViewPayroll) return <Navigate to="/dashboard" replace />;

  const createPeriod = async () => {
    setCreating(true);
    const { error } = await supabase
      .from('payroll_periods')
      .insert({ period_year: year, period_month: month });
    setCreating(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`Payroll period ${MONTHS[month - 1]} ${year} created`);
    setDialogOpen(false);
    fetchPeriods();
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Calculator className="h-7 w-7 text-primary" /> Payroll
          </h1>
          <p className="text-muted-foreground">
            Kenya-compliant monthly payroll periods. Engine runs in Phase 2 — Phase 1 is data & workflow foundation.
          </p>
        </div>
        {canCreate && (
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> New Period
          </Button>
        )}
      </div>

      <Alert>
        <ShieldAlert className="h-4 w-4" />
        <AlertTitle>Kenya payroll engine live</AlertTitle>
        <AlertDescription>
          PAYE, NSSF, SHIF, Housing Levy, overtime, night/PH allowances, and active loan deductions are calculated
          automatically. Staff can view payslips under My Payslips. Export bank CSV after Finance approval.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>Periods</CardTitle>
          <CardDescription>One row per calendar month. Status shows current step in the approval workflow.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : periods.length === 0 ? (
            <p className="text-sm text-muted-foreground">No payroll periods yet. Create one to begin.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Period</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {periods.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">
                      {MONTHS[p.period_month - 1]} {p.period_year}
                    </TableCell>
                    <TableCell>
                      <Badge className={STATUS_STYLES[p.status]}>
                        {p.status === 'LOCKED' && <Lock className="mr-1 h-3 w-3" />}
                        {p.status.replace(/_/g, ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell>{new Date(p.created_at).toLocaleDateString()}</TableCell>
                    <TableCell className="text-right">
                      <Button asChild variant="outline" size="sm">
                        <Link to={`/payroll/${p.id}`}>Open</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New payroll period</DialogTitle>
            <DialogDescription>
              A payroll period represents one calendar month. It starts in DRAFT — no calculations run yet.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 py-2">
            <div>
              <label className="text-sm font-medium mb-1 block">Month</label>
              <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MONTHS.map((m, i) => (
                    <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Year</label>
              <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {years.map((y) => (
                    <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={createPeriod} disabled={creating}>
              {creating ? 'Creating…' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
