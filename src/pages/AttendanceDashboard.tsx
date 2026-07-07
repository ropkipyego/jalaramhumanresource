import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Clock, AlertTriangle, Moon, CalendarDays, Coffee } from 'lucide-react';

export default function AttendanceDashboard() {
  const [stats, setStats] = useState({ templates: 0, holidays: 0, activeStaff: 0 });

  useEffect(() => {
    (async () => {
      const [t, h, s] = await Promise.all([
        supabase.from('shift_templates').select('id', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('public_holidays').select('id', { count: 'exact', head: true }).gte('holiday_date', new Date().toISOString().slice(0, 10)),
        supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('hr_status', 'ACTIVE'),
      ]);
      setStats({ templates: t.count ?? 0, holidays: h.count ?? 0, activeStaff: s.count ?? 0 });
    })();
  }, []);

  const kpis = [
    { label: 'Active Shift Templates', value: stats.templates, icon: Clock },
    { label: 'Upcoming Holidays', value: stats.holidays, icon: CalendarDays },
    { label: 'Active Staff', value: stats.activeStaff, icon: Users },
    { label: 'Present Today', value: '—', icon: Coffee },
    { label: 'On Night Shift', value: '—', icon: Moon },
    { label: 'Open Exceptions', value: '—', icon: AlertTriangle },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Time & Attendance</h1>
        <p className="text-muted-foreground text-sm">
          Phase A live — foundations, shift templates, holidays and settings. Live attendance figures activate in Phase B (biometric import + engine).
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {kpis.map((k) => (
          <Card key={k.label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{k.label}</CardTitle>
              <k.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent><div className="text-2xl font-bold">{k.value}</div></CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader><CardTitle>Roadmap</CardTitle></CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p><strong>Phase A (now):</strong> Shift templates, holiday calendar, attendance settings, rota-template linkage.</p>
          <p><strong>Phase B:</strong> Biometric Excel import, attendance calculation engine, exceptions, overtime queue, self-view.</p>
          <p><strong>Phase C:</strong> Supervisor → HR → Lock approval workflow, reports (PDF/Excel), payroll bridge (payroll consumes only approved attendance).</p>
        </CardContent>
      </Card>
    </div>
  );
}
