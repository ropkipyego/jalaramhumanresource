import { useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useRole } from '@/hooks/useRole';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Landmark, Loader2, Pencil, Plus, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';
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

const SIMPLE_TYPES: StatutoryRateType[] = [
  'PERSONAL_RELIEF', 'NSSF_TIER1', 'NSSF_TIER2', 'SHIF', 'HOUSING_LEVY',
];

const kes = (n: number) =>
  new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', maximumFractionDigits: 0 }).format(n);
const pct = (n: number) => `${(n * 100).toFixed(2).replace(/\.00$/, '')}%`;

function isCurrent(r: Rate) {
  return !r.effective_to || r.effective_to >= new Date().toISOString().slice(0, 10);
}

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
  const [editing, setEditing] = useState<Rate | null>(null);
  const [creatingType, setCreatingType] = useState<StatutoryRateType | null>(null);
  const [configText, setConfigText] = useState('');
  const [effectiveFrom, setEffectiveFrom] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [otMult, setOtMult] = useState('1.5');
  const [settingsId, setSettingsId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const [{ data }, { data: settings }] = await Promise.all([
      supabase.from('statutory_rates').select('*').order('rate_type').order('effective_from', { ascending: false }),
      supabase.from('payroll_settings').select('id, overtime_rate_multiplier').limit(1).maybeSingle(),
    ]);
    setRates((data as Rate[]) || []);
    if (settings) {
      setSettingsId(settings.id);
      setOtMult(String((settings as any).overtime_rate_multiplier ?? 1.5));
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const currentByType = useMemo(() => {
    const map = new Map<StatutoryRateType, Rate>();
    for (const r of rates) {
      if (!map.has(r.rate_type) && isCurrent(r)) map.set(r.rate_type, r);
    }
    return map;
  }, [rates]);

  if (!canViewPayroll && !isSuperAdmin) return <Navigate to="/dashboard" replace />;

  const openEdit = (r: Rate) => {
    setEditing(r);
    setCreatingType(null);
    setConfigText(JSON.stringify(r.config, null, 2));
    setEffectiveFrom(new Date().toISOString().slice(0, 10));
    setNotes(r.notes || '');
  };

  const openNewVersion = (type: StatutoryRateType) => {
    const cur = currentByType.get(type);
    setEditing(null);
    setCreatingType(type);
    setConfigText(JSON.stringify(cur?.config ?? {}, null, 2));
    setEffectiveFrom(new Date().toISOString().slice(0, 10));
    setNotes(cur?.notes || '');
  };

  const saveVersion = async () => {
    if (!isSuperAdmin) {
      toast.error('Only SUPER_ADMIN can edit rates');
      return;
    }
    const type = creatingType || editing?.rate_type;
    if (!type) return;
    let config: Record<string, unknown>;
    try {
      config = JSON.parse(configText);
    } catch {
      toast.error('Config must be valid JSON');
      return;
    }
    if (!effectiveFrom) {
      toast.error('effective_from is required');
      return;
    }
    setBusy(true);
    const dayBefore = new Date(effectiveFrom);
    dayBefore.setDate(dayBefore.getDate() - 1);
    const closeTo = dayBefore.toISOString().slice(0, 10);
    await supabase
      .from('statutory_rates')
      .update({ effective_to: closeTo } as any)
      .eq('rate_type', type)
      .is('effective_to', null)
      .lt('effective_from', effectiveFrom);

    const { error } = await supabase.from('statutory_rates').insert({
      rate_type: type,
      config,
      effective_from: effectiveFrom,
      effective_to: null,
      notes: notes || null,
    } as any);
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success('New rate version saved (audit logged)');
    setEditing(null);
    setCreatingType(null);
    load();
  };

  const saveOt = async () => {
    if (!isSuperAdmin) return;
    const n = Number(otMult);
    if (!Number.isFinite(n) || n <= 0) {
      toast.error('OT multiplier must be a positive number');
      return;
    }
    setBusy(true);
    let error;
    if (settingsId) {
      ({ error } = await supabase.from('payroll_settings').update({ overtime_rate_multiplier: n } as any).eq('id', settingsId));
    } else {
      const res = await supabase.from('payroll_settings').insert({ scope: 'GLOBAL', overtime_rate_multiplier: n } as any).select('id').maybeSingle();
      error = res.error;
      if (res.data) setSettingsId(res.data.id);
    }
    setBusy(false);
    if (error) toast.error(error.message);
    else toast.success('Overtime multiplier saved');
  };

  return (
    <div className="space-y-6 p-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Landmark className="h-7 w-7 text-primary" /> Statutory Settings (Kenya)
        </h1>
        <p className="text-muted-foreground">
          Plain-language rates the payroll engine uses. Editing inserts a new version so past payslips stay reproducible.
        </p>
      </div>

      <Alert>
        <ShieldAlert className="h-4 w-4" />
        <AlertTitle>Verify with your Finance team before payroll go-live</AlertTitle>
        <AlertDescription>
          Confirm PAYE, NSSF, SHIF, and Housing Levy. Only SUPER_ADMIN can save; every change is audit-logged.
        </AlertDescription>
      </Alert>

      {isSuperAdmin && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Overtime multiplier</CardTitle>
            <CardDescription>Applied to hourly rate × approved OT minutes in payroll calculation.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3 items-end">
            <div>
              <Label>Multiplier</Label>
              <Input className="w-32" value={otMult} onChange={(e) => setOtMult(e.target.value)} />
            </div>
            <Button onClick={saveOt} disabled={busy}>
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save
            </Button>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {(Object.keys(LABELS) as StatutoryRateType[]).map((type) => {
            const cur = currentByType.get(type);
            const history = rates.filter((r) => r.rate_type === type);
            const h = humanize(type, cur?.config || {});
            return (
              <Card key={type} className="animate-fade-in">
                <CardHeader>
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-lg">{LABELS[type]}</CardTitle>
                    {cur ? (
                      <Badge variant="outline">from {cur.effective_from}</Badge>
                    ) : (
                      <Badge variant="destructive">Missing</Badge>
                    )}
                  </div>
                  {h.summary && <CardDescription>{h.summary}</CardDescription>}
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="divide-y rounded border">
                    {h.rows.map((row, i) => (
                      <div key={i} className="flex items-center justify-between px-3 py-2">
                        <span className="text-sm text-muted-foreground">{row.label}</span>
                        <span className="font-semibold">{row.value}</span>
                      </div>
                    ))}
                  </div>
                  {cur?.notes && <p className="text-xs text-muted-foreground">Note: {cur.notes}</p>}
                  {isSuperAdmin && (
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => (cur ? openEdit(cur) : openNewVersion(type))}>
                        <Pencil className="mr-2 h-3.5 w-3.5" />
                        New version
                      </Button>
                      {SIMPLE_TYPES.includes(type) && !cur && (
                        <Button size="sm" onClick={() => openNewVersion(type)}>
                          <Plus className="mr-2 h-3.5 w-3.5" /> Add
                        </Button>
                      )}
                    </div>
                  )}
                  {history.length > 1 && (
                    <p className="text-xs text-muted-foreground">{history.length} version(s) on file</p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={!!editing || !!creatingType} onOpenChange={(o) => { if (!o) { setEditing(null); setCreatingType(null); } }}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>
              New version — {LABELS[(creatingType || editing?.rate_type)!]}
            </DialogTitle>
            <DialogDescription>
              Previous open versions are closed the day before the new effective date. Past payroll keeps using older rows.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Effective from</Label>
              <Input type="date" value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} />
            </div>
            <div>
              <Label>Notes</Label>
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Finance Act 2025 update" />
            </div>
            <div>
              <Label>Config (JSON)</Label>
              <Textarea className="font-mono text-xs min-h-[220px]" value={configText} onChange={(e) => setConfigText(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setEditing(null); setCreatingType(null); }}>Cancel</Button>
            <Button onClick={saveVersion} disabled={busy}>
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save version
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
