import React, { useEffect, useState } from 'react';
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
  config: Record<string, unknown>;
  effective_from: string;
  effective_to: string | null;
  notes: string | null;
}

const LABELS: Record<StatutoryRateType, string> = {
  PAYE_BAND: 'PAYE (KRA tax bands)',
  PERSONAL_RELIEF: 'Personal Relief',
  NSSF_TIER1: 'NSSF Tier I',
  NSSF_TIER2: 'NSSF Tier II',
  SHIF: 'SHIF (Social Health Insurance)',
  HOUSING_LEVY: 'Affordable Housing Levy',
};

export default function StatutorySettings() {
  const { isSuperAdmin, canViewPayroll } = useRole();
  const [rates, setRates] = useState<Rate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('statutory_rates')
        .select('*')
        .order('rate_type')
        .order('effective_from', { ascending: false });
      setRates((data as Rate[]) || []);
      setLoading(false);
    })();
  }, []);

  if (!canViewPayroll && !isSuperAdmin) return <Navigate to="/dashboard" replace />;

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Landmark className="h-7 w-7 text-primary" /> Statutory Settings (Kenya)
        </h1>
        <p className="text-muted-foreground">
          Reference rates used by the payroll engine. Versioned by <em>effective_from</em> so historical payroll stays reproducible.
        </p>
      </div>

      <Alert>
        <ShieldAlert className="h-4 w-4" />
        <AlertTitle>Verify with your Finance team before Phase 2 go-live</AlertTitle>
        <AlertDescription>
          These are the current 2024/2025 defaults (PAYE Finance Act 2023, NSSF Act 2013, SHIF regulations 2024,
          Affordable Housing Act 2024). Only a SUPER_ADMIN can edit rates, and every change is written to the payroll
          audit log. Editing UI ships in Phase 2 — for now this page is a read-only reference.
        </AlertDescription>
      </Alert>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {rates.map((r) => (
            <Card key={r.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{LABELS[r.rate_type]}</CardTitle>
                  <Badge variant="outline">from {r.effective_from}</Badge>
                </div>
                {r.notes && <CardDescription>{r.notes}</CardDescription>}
              </CardHeader>
              <CardContent>
                <pre className="text-xs bg-muted rounded p-3 overflow-auto">
                  {JSON.stringify(r.config, null, 2)}
                </pre>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
