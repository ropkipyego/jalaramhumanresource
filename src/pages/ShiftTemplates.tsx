import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { useRole } from '@/hooks/useRole';

type Shift = {
  id: string; name: string; code: string; start_time: string; end_time: string;
  crosses_midnight: boolean; expected_hours: number;
  grace_before_min: number; grace_after_min: number;
  min_ot_minutes: number; ot_round_minutes: number; meal_break_minutes: number;
  paid_break: boolean; is_night: boolean; is_weekend: boolean; is_holiday: boolean; is_active: boolean;
};

const empty: Partial<Shift> = {
  name: '', code: '', start_time: '08:00', end_time: '18:00', crosses_midnight: false,
  expected_hours: 10, grace_before_min: 10, grace_after_min: 10,
  min_ot_minutes: 30, ot_round_minutes: 15, meal_break_minutes: 30,
  paid_break: false, is_night: false, is_weekend: false, is_holiday: false, is_active: true,
};

export default function ShiftTemplates() {
  const { hasRole } = useRole();
  const canEdit = hasRole('ADMIN');
  const [rows, setRows] = useState<Shift[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Partial<Shift>>(empty);
  const [editing, setEditing] = useState<string | null>(null);

  const load = async () => {
    const { data, error } = await supabase.from('shift_templates').select('*').order('code');
    if (error) return toast.error(error.message);
    setRows((data as any) ?? []);
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!form.name || !form.code) return toast.error('Name and code required');
    const payload = { ...form };
    const res = editing
      ? await supabase.from('shift_templates').update(payload as any).eq('id', editing)
      : await supabase.from('shift_templates').insert(payload as any);
    if (res.error) return toast.error(res.error.message);
    toast.success('Saved'); setOpen(false); setEditing(null); setForm(empty); load();
  };

  const remove = async (id: string) => {
    if (!confirm('Delete shift template?')) return;
    const { error } = await supabase.from('shift_templates').delete().eq('id', id);
    if (error) return toast.error(error.message);
    toast.success('Deleted'); load();
  };

  const edit = (r: Shift) => { setEditing(r.id); setForm(r); setOpen(true); };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Shift Templates</h1>
          <p className="text-sm text-muted-foreground">Configurable shifts used by rota &amp; attendance. Nothing is hardcoded.</p>
        </div>
        {canEdit && (
          <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setEditing(null); setForm(empty); } }}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" /> New Shift</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>{editing ? 'Edit' : 'New'} Shift Template</DialogTitle></DialogHeader>
              <div className="grid grid-cols-2 gap-4 py-2">
                <div><Label>Name</Label><Input value={form.name ?? ''} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
                <div><Label>Code</Label><Input value={form.code ?? ''} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} /></div>
                <div><Label>Start Time</Label><Input type="time" value={form.start_time ?? ''} onChange={(e) => setForm({ ...form, start_time: e.target.value })} /></div>
                <div><Label>End Time</Label><Input type="time" value={form.end_time ?? ''} onChange={(e) => setForm({ ...form, end_time: e.target.value })} /></div>
                <div><Label>Expected Hours</Label><Input type="number" step="0.25" value={form.expected_hours ?? 0} onChange={(e) => setForm({ ...form, expected_hours: +e.target.value })} /></div>
                <div><Label>Meal Break (min)</Label><Input type="number" value={form.meal_break_minutes ?? 0} onChange={(e) => setForm({ ...form, meal_break_minutes: +e.target.value })} /></div>
                <div><Label>Grace Before (min)</Label><Input type="number" value={form.grace_before_min ?? 0} onChange={(e) => setForm({ ...form, grace_before_min: +e.target.value })} /></div>
                <div><Label>Grace After (min)</Label><Input type="number" value={form.grace_after_min ?? 0} onChange={(e) => setForm({ ...form, grace_after_min: +e.target.value })} /></div>
                <div><Label>Min OT (min)</Label><Input type="number" value={form.min_ot_minutes ?? 0} onChange={(e) => setForm({ ...form, min_ot_minutes: +e.target.value })} /></div>
                <div><Label>OT Round (min)</Label><Input type="number" value={form.ot_round_minutes ?? 0} onChange={(e) => setForm({ ...form, ot_round_minutes: +e.target.value })} /></div>
                {(['crosses_midnight','paid_break','is_night','is_weekend','is_holiday','is_active'] as const).map((k) => (
                  <div key={k} className="flex items-center justify-between border rounded-md px-3 py-2">
                    <Label className="capitalize">{k.replaceAll('_', ' ')}</Label>
                    <Switch checked={!!(form as any)[k]} onCheckedChange={(v) => setForm({ ...form, [k]: v })} />
                  </div>
                ))}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button onClick={save}>Save</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Card>
        <CardHeader><CardTitle>All shift templates</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead><TableHead>Name</TableHead><TableHead>Hours</TableHead>
                <TableHead>Window</TableHead><TableHead>Flags</TableHead><TableHead>Status</TableHead>
                {canEdit && <TableHead className="text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono">{r.code}</TableCell>
                  <TableCell>{r.name}</TableCell>
                  <TableCell>{r.expected_hours}h</TableCell>
                  <TableCell>{r.start_time.slice(0,5)} → {r.end_time.slice(0,5)}{r.crosses_midnight && ' (+1)'}</TableCell>
                  <TableCell className="space-x-1">
                    {r.is_night && <Badge variant="secondary">Night</Badge>}
                    {r.is_weekend && <Badge variant="secondary">Weekend</Badge>}
                    {r.is_holiday && <Badge variant="secondary">Holiday</Badge>}
                  </TableCell>
                  <TableCell>{r.is_active ? <Badge>Active</Badge> : <Badge variant="outline">Inactive</Badge>}</TableCell>
                  {canEdit && (
                    <TableCell className="text-right space-x-1">
                      <Button size="icon" variant="ghost" onClick={() => edit(r)}><Pencil className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => remove(r.id)}><Trash2 className="h-4 w-4" /></Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
              {rows.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No shift templates yet.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
