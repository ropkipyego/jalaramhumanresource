import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Plus, Trash2, Pencil } from 'lucide-react';
import { useRole } from '@/hooks/useRole';

type H = { id: string; holiday_date: string; name: string; scope: string; county: string | null; is_paid: boolean; notes: string | null };
const empty: Partial<H> = { holiday_date: '', name: '', scope: 'NATIONAL', is_paid: true, county: null, notes: '' };

export default function HolidayCalendar() {
  const { hasRole } = useRole();
  const canEdit = hasRole('ADMIN');
  const [rows, setRows] = useState<H[]>([]);
  const [form, setForm] = useState<Partial<H>>(empty);
  const [editing, setEditing] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const load = async () => {
    const { data, error } = await supabase.from('public_holidays').select('*').order('holiday_date');
    if (error) return toast.error(error.message);
    setRows((data as any) ?? []);
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!form.holiday_date || !form.name) return toast.error('Date and name required');
    const res = editing
      ? await supabase.from('public_holidays').update(form as any).eq('id', editing)
      : await supabase.from('public_holidays').insert(form as any);
    if (res.error) return toast.error(res.error.message);
    toast.success('Saved'); setOpen(false); setEditing(null); setForm(empty); load();
  };
  const remove = async (id: string) => {
    if (!confirm('Delete holiday?')) return;
    const { error } = await supabase.from('public_holidays').delete().eq('id', id);
    if (error) return toast.error(error.message);
    load();
  };
  const edit = (r: H) => { setEditing(r.id); setForm(r); setOpen(true); };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Holiday Calendar</h1>
          <p className="text-sm text-muted-foreground">National, hospital, county &amp; custom holidays. Payroll uses this for holiday pay.</p>
        </div>
        {canEdit && (
          <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setEditing(null); setForm(empty); } }}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" /> New Holiday</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{editing ? 'Edit' : 'New'} Holiday</DialogTitle></DialogHeader>
              <div className="grid gap-3">
                <div><Label>Date</Label><Input type="date" value={form.holiday_date ?? ''} onChange={(e) => setForm({ ...form, holiday_date: e.target.value })} /></div>
                <div><Label>Name</Label><Input value={form.name ?? ''} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
                <div><Label>Scope</Label>
                  <Select value={form.scope} onValueChange={(v) => setForm({ ...form, scope: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NATIONAL">National</SelectItem>
                      <SelectItem value="HOSPITAL">Hospital</SelectItem>
                      <SelectItem value="COUNTY">County</SelectItem>
                      <SelectItem value="CUSTOM">Custom</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {form.scope === 'COUNTY' && <div><Label>County</Label><Input value={form.county ?? ''} onChange={(e) => setForm({ ...form, county: e.target.value })} /></div>}
                <div className="flex items-center justify-between border rounded-md px-3 py-2">
                  <Label>Paid Holiday</Label>
                  <Switch checked={!!form.is_paid} onCheckedChange={(v) => setForm({ ...form, is_paid: v })} />
                </div>
                <div><Label>Notes</Label><Input value={form.notes ?? ''} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
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
        <CardHeader><CardTitle>Holidays</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow>
              <TableHead>Date</TableHead><TableHead>Name</TableHead><TableHead>Scope</TableHead>
              <TableHead>Paid</TableHead>{canEdit && <TableHead className="text-right">Actions</TableHead>}
            </TableRow></TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono">{r.holiday_date}</TableCell>
                  <TableCell>{r.name}</TableCell>
                  <TableCell><Badge variant="secondary">{r.scope}{r.county ? ` · ${r.county}` : ''}</Badge></TableCell>
                  <TableCell>{r.is_paid ? <Badge>Paid</Badge> : <Badge variant="outline">Unpaid</Badge>}</TableCell>
                  {canEdit && (
                    <TableCell className="text-right space-x-1">
                      <Button size="icon" variant="ghost" onClick={() => edit(r)}><Pencil className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => remove(r.id)}><Trash2 className="h-4 w-4" /></Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
              {rows.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No holidays configured.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
