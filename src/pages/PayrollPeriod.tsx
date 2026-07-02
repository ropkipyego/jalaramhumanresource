import React, { useEffect, useState } from 'react';
import { Link, useParams, Navigate } from 'react-router-dom';
import { useRole } from '@/hooks/useRole';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ArrowLeft, Lock, ShieldAlert } from 'lucide-react';
import type { PayrollPeriodStatus } from '@/types/database';

interface Period {
  id: string;
  period_year: number;
  period_month: number;
  status: PayrollPeriodStatus;
  hr_reviewed_by: string | null;
  finance_approved_by: string | null;
  locked_by: string | null;
  created_at: string;
}

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export default function PayrollPeriod() {
  const { periodId } = useParams();
  const { canViewPayroll } = useRole();
  const [period, setPeriod] = useState<Period | null>(null);
  const [runsCount, setRunsCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!periodId) return;
    (async () => {
      const [{ data: p }, { count }] = await Promise.all([
        supabase.from('payroll_periods').select('*').eq('id', periodId).maybeSingle(),
        supabase.from('payroll_runs').select('id', { count: 'exact', head: true }).eq('period_id', periodId),
      ]);
      setPeriod(p as Period | null);
      setRunsCount(count || 0);
      setLoading(false);
    })();
  }, [periodId]);

  if (!canViewPayroll) return <Navigate to="/dashboard" replace />;
  if (loading) return <div className="p-6 text-muted-foreground">Loading…</div>;
  if (!period) return <div className="p-6">Period not found.</div>;

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link to="/payroll"><ArrowLeft className="mr-2 h-4 w-4" /> Back</Link>
        </Button>
      </div>
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          {MONTHS[period.period_month - 1]} {period.period_year}
          <Badge>{period.status.replace(/_/g, ' ')}</Badge>
        </h1>
        <p className="text-muted-foreground">Payroll period detail — Phase 1 (read-only).</p>
      </div>

      <Alert>
        <ShieldAlert className="h-4 w-4" />
        <AlertTitle>Approval workflow is disabled in Phase 1</AlertTitle>
        <AlertDescription>
          The steps below reflect the target workflow. Buttons will activate in Phase 2 once the calculation engine
          (PAYE / NSSF / SHIF / Housing Levy) is enabled. Segregation of duties is already enforced in the database —
          the HR reviewer cannot also approve as Finance, and only a FINANCE_ADMIN can approve.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>Workflow</CardTitle>
          <CardDescription>Each step is audited to the payroll audit log.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {[
            { s: 'DRAFT', label: '1. Draft — HR opens the period' },
            { s: 'ATTENDANCE_LOCKED', label: '2. Attendance locked — no more edits to shifts/leave' },
            { s: 'CALCULATED', label: '3. Calculated — engine computes earnings & deductions (Phase 2)' },
            { s: 'HR_REVIEWED', label: '4. HR reviewed — HR signs off numbers' },
            { s: 'FINANCE_APPROVED', label: '5. Finance approved — FINANCE_ADMIN only' },
            { s: 'LOCKED', label: '6. Locked — SUPER_ADMIN finalises; period becomes immutable' },
          ].map((step) => (
            <div key={step.s} className="flex items-center justify-between border rounded-lg px-3 py-2">
              <span className="text-sm">{step.label}</span>
              {period.status === step.s && <Badge variant="outline">Current</Badge>}
              {step.s === 'LOCKED' && period.status === 'LOCKED' && (
                <Badge variant="destructive"><Lock className="mr-1 h-3 w-3" /> Locked</Badge>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Runs</CardTitle>
          <CardDescription>One payroll run per employee. Populated by the engine in Phase 2.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm">
            <span className="font-semibold">{runsCount}</span> run(s) recorded for this period.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
