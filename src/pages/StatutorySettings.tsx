import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useRole } from '@/hooks/useRole';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Landmark, ShieldAlert } from 'lucide-react';
import type { StatutoryRateType } from '@/types/database';

interface Rate {
  id: string;
  rate_type: StatutoryRateType;
  config: Record<string, any>;
  effective_from: string;
  effective_to: string | null;
  notes: string | null;
}

const LABELS: Record<StatutoryRateType, string> = {
  PAYE_BAND: 'PAYE — Kenya Income Tax',
  PERSONAL_RELIEF: 'Personal Tax Relief',
  NSSF_TIER1: 'NSSF Tier I (Pension)',
  NSSF_TIER2: 'NSSF Tier II (Pension)',
  SHIF: 'SHIF — Social Health Insurance',
  HOUSING_LEVY: 'Affordable Housing Levy',
};

const kes = (n: number) =>
  new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', maximumFractionDigits: 0 }).format(n);
const pct = (n: number) => `${(n * 100).toFixed(2).replace(/\.00$/, '')}%`;

function humanize(type: StatutoryRateType, cfg: Record<string, any>): { rows: { label: string; value: string }[]; summary?: string } {
  switch (type) {
    case 'PAYE_BAND': {
      const bands: any[] = cfg.bands || [];
      return {
        summary: 'Progressive income tax charged on gross pay less NSSF, SHIF and Housing Levy. Every band is applied in turn.',
        rows: bands.map((b, i) => {
          const prev = i > 0 ? Number(bands[i - 1].upto) : 0;
          const upto = b.upto ? Number(b.upto) : null;
          const range = upto ? `${kes(prev)} – ${kes(upto)}` : `Above ${kes(prev)}`;
          return { label: range, value: pct(Number(b.rate)) };
        }),
      };
    }
    case 'PERSONAL_RELIEF': {
      const monthly = Number(cfg.monthly_kes || 0);
      return {
        summary: 'A fixed amount deducted from calculated PAYE each month for every taxpayer.',
        rows: [{ label: 'Monthly relief', value: kes(monthly) }],
      };
    }
    case 'NSSF_TIER1':
      return {
        summary: 'First tier of NSSF — applies to earnings up to the tier ceiling. Employee and employer contribute the same rate.',
        rows: [
          { label: 'Employee & Employer rate', value: pct(Number(cfg.rate || 0)) },
          { label: 'Earnings ceiling', value: kes(Number(cfg.upper || 0)) },
        ],
      };
    case 'NSSF_TIER2':
      return {
        summary: 'Second tier of NSSF — applies to the portion of earnings between the tier boundaries.',
        rows: [
          { label: 'Employee & Employer rate', value: pct(Number(cfg.rate || 0)) },
          { label: 'From', value: kes(Number(cfg.lower || 0)) },
          { label: 'Up to', value: kes(Number(cfg.upper || 0)) },
        ],
      };
    case 'SHIF':
      return {
        summary: 'Social Health Insurance Fund — a percentage of gross pay with a minimum monthly contribution.',
        rows: [
          { label: 'Rate on gross', value: pct(Number(cfg.rate || 0)) },
          { label: 'Minimum contribution', value: kes(Number(cfg.min_kes || 0)) },
        ],
      };
    case 'HOUSING_LEVY':
      return {
        summary: 'Affordable Housing Levy — a percentage of gross pay contributed by both employee and employer.',
        rows: [
          { label: 'Employee rate', value: pct(Number(cfg.employee_rate || 0)) },
          { label: 'Employer rate', value: pct(Number(cfg.employer_rate || 0)) },
        ],
      };
    default:
      return { rows: Object.entries(cfg).map(([k, v]) => ({ label: k, value: String(v) })) };
  }
}

export default function StatutorySettings() {
  const { isSuperAdmin, canViewPayroll } = useRole();
  const [rates, setRates] = useState<Rate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('statutory_rates').select('*')
        .order('rate_type').order('effective_from', { ascending: false });
      setRates((data as Rate[]) || []);
      setLoading(false);
    })();
  }, []);

  if (!canViewPayroll && !isSuperAdmin) return <Navigate to="/dashboard" replace />;

  return (
    <div className="space-y-6 p-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Landmark className="h-7 w-7 text-primary" /> Statutory Settings (Kenya)
        </h1>
        <p className="text-muted-foreground">
          Plain-language reference for every rate the payroll engine uses. Historical payroll always uses the version that was
          effective on the payroll month, so old payslips stay reproducible.
        </p>
      </div>

      <Alert>
        <ShieldAlert className="h-4 w-4" />
        <AlertTitle>Verify with your Finance team before payroll go-live</AlertTitle>
        <AlertDescription>
          These are the current 2024/2025 defaults (PAYE Finance Act 2023, NSSF Act 2013, SHIF regulations 2024, Affordable
          Housing Act 2024). Only a Super Admin can edit rates, and every change is written to the payroll audit log.
        </AlertDescription>
      </Alert>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {rates.map((r) => {
            const h = humanize(r.rate_type, r.config || {});
            return (
              <Card key={r.id} className="animate-fade-in">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{LABELS[r.rate_type]}</CardTitle>
                    <Badge variant="outline">Effective from {r.effective_from}</Badge>
                  </div>
                  {h.summary && <CardDescription>{h.summary}</CardDescription>}
                </CardHeader>
                <CardContent>
                  <div className="divide-y rounded border">
                    {h.rows.map((row, i) => (
                      <div key={i} className="flex items-center justify-between px-3 py-2">
                        <span className="text-sm text-muted-foreground">{row.label}</span>
                        <span className="font-semibold">{row.value}</span>
                      </div>
                    ))}
                  </div>
                  {r.notes && <p className="text-xs text-muted-foreground mt-2">Note: {r.notes}</p>}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
