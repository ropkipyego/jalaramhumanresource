import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { useRole } from '@/hooks/useRole';
import { Navigate } from 'react-router-dom';

export default function AttendanceSettings() {
  const { isSuperAdmin } = useRole();
  const [s, setS] = useState<any>(null);

  useEffect(() => {
    supabase.from('attendance_settings').select('*').single().then(({ data }) => setS(data));
  }, []);

  if (!isSuperAdmin) return <Navigate to="/attendance" replace />;
  if (!s) return <div>Loading…</div>;

  const save = async () => {
    const { error } = await supabase.from('attendance_settings').update({ ...s, updated_at: new Date().toISOString() }).eq('id', true);
    if (error) return toast.error(error.message);
    toast.success('Settings saved');
  };

  const num = (k: string, label: string) => (
    <div key={k}><Label>{label}</Label>
      <Input type="number" value={s[k] ?? 0} onChange={(e) => setS({ ...s, [k]: +e.target.value })} />
    </div>
  );
  const time = (k: string, label: string) => (
    <div key={k}><Label>{label}</Label>
      <Input type="time" value={(s[k] ?? '').slice(0,5)} onChange={(e) => setS({ ...s, [k]: e.target.value })} />
    </div>
  );
  const bool = (k: string, label: string) => (
    <div key={k} className="flex items-center justify-between border rounded-md px-3 py-2">
      <Label>{label}</Label>
      <Switch checked={!!s[k]} onCheckedChange={(v) => setS({ ...s, [k]: v })} />
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Attendance Settings</h1>
        <p className="text-sm text-muted-foreground">Global rules used by the attendance engine. All configurable — no code changes needed.</p>
      </div>
      <Card>
        <CardHeader><CardTitle>Thresholds</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          {num('late_threshold_min', 'Late Threshold (min)')}
          {num('grace_min', 'Grace (min)')}
          {num('min_ot_min', 'Minimum OT (min)')}
          {num('ot_round_min', 'OT Rounding (min)')}
          {num('max_daily_ot_min', 'Max Daily OT (min)')}
          {num('max_monthly_ot_min', 'Max Monthly OT (min)')}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Night Shift</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          {time('night_start', 'Night Start')}
          {time('night_end', 'Night End')}
          {num('night_diff_pct', 'Night Differential (%)')}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Weekend</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          {bool('saturday_working', 'Saturday is a working day')}
          {bool('sunday_working', 'Sunday is a working day')}
          {num('weekend_ot_pct', 'Weekend OT (%)')}
          {num('weekend_allow_pct', 'Weekend Allowance (%)')}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Approval &amp; Lock</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          {num('approval_levels', 'Approval Levels')}
          {bool('lock_after_payroll', 'Lock attendance after payroll close')}
        </CardContent>
      </Card>
      <div className="flex justify-end"><Button onClick={save}>Save Settings</Button></div>
    </div>
  );
}
