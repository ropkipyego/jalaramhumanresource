import React, { useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { format, startOfWeek, addDays } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext';
import { useRole } from '@/hooks/useRole';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Upload, Download, FileSpreadsheet, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import type { Department, Profile, ShiftCode } from '@/types/database';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const VALID_CODES: ShiftCode[] = ['D', 'N', 'OFF', 'PH'];

type ParsedRow = {
  staffId: string;
  name: string;
  matchedEmployeeId: string | null;
  shifts: (ShiftCode | null)[]; // 7
  error?: string;
};

export default function RotaUpload() {
  const { user, departments: userDepartments } = useAuth();
  const { hasRole, headDepartments } = useRole();

  const manageableDepartments = useMemo<Department[]>(() => {
    if (hasRole('ADMIN')) return userDepartments.map((d) => d.department);
    return userDepartments.filter((d) => headDepartments.includes(d.department_id)).map((d) => d.department);
  }, [userDepartments, headDepartments, hasRole]);

  const [departmentId, setDepartmentId] = useState<string>('');
  const [weekStart, setWeekStart] = useState<string>(format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd'));
  const [employees, setEmployees] = useState<Profile[]>([]);
  const [parsed, setParsed] = useState<ParsedRow[] | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);

  useEffect(() => {
    if (manageableDepartments.length > 0 && !departmentId) {
      setDepartmentId(manageableDepartments[0].id);
    }
  }, [manageableDepartments, departmentId]);

  useEffect(() => {
    if (!departmentId) return;
    (async () => {
      const { data } = await supabase
        .from('employee_departments')
        .select('employee:profiles(*)')
        .eq('department_id', departmentId);
      const list = (data || [])
        .map((e: any) => e.employee as Profile)
        .filter((p): p is Profile => p !== null && p.is_active);
      setEmployees(list);
    })();
  }, [departmentId]);

  const downloadTemplate = () => {
    const dept = manageableDepartments.find((d) => d.id === departmentId);
    const headers = ['Staff ID', 'Full Name', ...DAYS.map((d, i) => `${d} ${format(addDays(new Date(weekStart), i), 'd MMM')}`)];
    const rows = employees.map((e) => [e.staff_id, e.full_name, '', '', '', '', '', '', '']);
    const aoa = [headers, ...rows];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = [{ wch: 12 }, { wch: 24 }, ...DAYS.map(() => ({ wch: 12 }))];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `Rota ${weekStart}`);
    XLSX.writeFile(wb, `rota-${dept?.code || 'dept'}-${weekStart}.xlsx`);
    toast.success('Template downloaded — fill D/N/OFF/PH per cell and re-upload.');
  };

  const normalizeCode = (raw: unknown): ShiftCode | null | 'INVALID' => {
    if (raw === null || raw === undefined) return null;
    const s = String(raw).trim().toUpperCase();
    if (!s || s === '-' || s === '—') return null;
    if (VALID_CODES.includes(s as ShiftCode)) return s as ShiftCode;
    // friendly aliases
    if (['DAY'].includes(s)) return 'D';
    if (['NIGHT'].includes(s)) return 'N';
    if (['REST', 'O'].includes(s)) return 'OFF';
    if (['HOLIDAY', 'HOL'].includes(s)) return 'PH';
    return 'INVALID';
  };

  const handleFile = async (file: File) => {
    setFileName(file.name);
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: 'array' });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const aoa = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, defval: '' });
    if (aoa.length < 2) {
      toast.error('Sheet appears empty.');
      return;
    }
    const dataRows = aoa.slice(1);
    const out: ParsedRow[] = [];

    for (const row of dataRows) {
      const staffId = String(row[0] ?? '').trim();
      const name = String(row[1] ?? '').trim();
      if (!staffId && !name) continue;
      const match = employees.find(
        (e) => e.staff_id.toLowerCase() === staffId.toLowerCase() || e.full_name.toLowerCase() === name.toLowerCase()
      );
      const shifts: (ShiftCode | null)[] = [];
      let invalid = false;
      for (let i = 0; i < 7; i++) {
        const code = normalizeCode(row[2 + i]);
        if (code === 'INVALID') {
          invalid = true;
          shifts.push(null);
        } else {
          shifts.push(code);
        }
      }
      out.push({
        staffId,
        name,
        matchedEmployeeId: match?.id || null,
        shifts,
        error: !match
          ? `No matching staff in this department`
          : invalid
          ? 'Invalid shift code(s) — use D, N, OFF, PH'
          : undefined,
      });
    }

    setParsed(out);
    const matched = out.filter((r) => r.matchedEmployeeId).length;
    toast.success(`Parsed ${out.length} rows — ${matched} matched to staff.`);
  };

  const validRows = useMemo(() => (parsed || []).filter((r) => r.matchedEmployeeId && !r.error), [parsed]);
  const hasErrors = useMemo(() => (parsed || []).some((r) => r.error), [parsed]);

  const persist = async (publish: boolean) => {
    if (!user || !departmentId || validRows.length === 0) return;
    publish ? setPublishing(true) : setSaving(true);
    try {
      // upsert rota_week
      let weekId: string | null = null;
      const { data: existing } = await supabase
        .from('rota_weeks')
        .select('id, status')
        .eq('department_id', departmentId)
        .eq('week_start_date', weekStart)
        .maybeSingle();

      if (existing) {
        if (existing.status === 'published' && !publish) {
          toast.error('This week is already published. Save as Draft is disabled.');
          return;
        }
        weekId = existing.id;
      } else {
        const { data: created, error } = await supabase
          .from('rota_weeks')
          .insert({ department_id: departmentId, week_start_date: weekStart, status: 'draft' })
          .select()
          .single();
        if (error) throw error;
        weekId = created.id;
      }

      // wipe existing assignments
      await supabase.from('rota_assignments').delete().eq('rota_week_id', weekId!);

      const inserts: Array<{ rota_week_id: string; employee_id: string; day_of_week: number; shift_code: ShiftCode }> = [];
      for (const r of validRows) {
        r.shifts.forEach((s, i) => {
          if (s) inserts.push({ rota_week_id: weekId!, employee_id: r.matchedEmployeeId!, day_of_week: i, shift_code: s });
        });
      }
      if (inserts.length > 0) {
        const { error } = await supabase.from('rota_assignments').insert(inserts);
        if (error) throw error;
      }

      if (publish) {
        const { error } = await supabase
          .from('rota_weeks')
          .update({ status: 'published', published_at: new Date().toISOString(), published_by: user.id })
          .eq('id', weekId!);
        if (error) throw error;
        toast.success(`Published rota with ${inserts.length} shifts.`);
      } else {
        toast.success(`Saved draft with ${inserts.length} shifts.`);
      }

      setParsed(null);
      setFileName('');
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || 'Failed to save rota');
    } finally {
      setSaving(false);
      setPublishing(false);
    }
  };

  if (manageableDepartments.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center">
          <FileSpreadsheet className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Department Access</h3>
          <p className="text-muted-foreground">You don't have permission to upload rotas.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Upload Rota from Excel</h1>
        <p className="text-muted-foreground">
          Download the template, fill shifts (D, N, OFF, PH) per staff per day, then upload.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">1. Choose department & week</CardTitle>
          <CardDescription>The template is built from staff currently assigned to this department.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>Department</Label>
            <Select value={departmentId} onValueChange={setDepartmentId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent className="bg-popover z-50">
                {manageableDepartments.map((d) => (
                  <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Week starting (Monday)</Label>
            <Input
              type="date"
              value={weekStart}
              onChange={(e) => {
                const d = new Date(e.target.value);
                const monday = startOfWeek(d, { weekStartsOn: 1 });
                setWeekStart(format(monday, 'yyyy-MM-dd'));
              }}
            />
          </div>
          <div className="flex items-end">
            <Button onClick={downloadTemplate} variant="outline" className="w-full gap-2" disabled={!departmentId || employees.length === 0}>
              <Download className="h-4 w-4" /> Download template
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">2. Upload filled Excel</CardTitle>
          <CardDescription>Accepted shift codes: D (Day), N (Night), OFF, PH (Public Holiday). Empty cells = no shift.</CardDescription>
        </CardHeader>
        <CardContent>
          <label className="flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-8 cursor-pointer hover:bg-muted/50 transition">
            <Upload className="h-10 w-10 text-muted-foreground mb-2" />
            <span className="text-sm font-medium">{fileName || 'Click to choose an .xlsx file'}</span>
            <span className="text-xs text-muted-foreground mt-1">Max ~5MB</span>
            <input
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
            />
          </label>
        </CardContent>
      </Card>

      {parsed && (
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <CardTitle className="text-lg">3. Preview & save</CardTitle>
                <CardDescription>
                  {validRows.length} of {parsed.length} rows ready to import.
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => persist(false)} disabled={saving || publishing || validRows.length === 0}>
                  {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Save as Draft
                </Button>
                <Button onClick={() => persist(true)} disabled={saving || publishing || validRows.length === 0}>
                  {publishing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Save & Publish
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {hasErrors && (
              <Alert variant="destructive" className="mb-4">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Some rows were skipped</AlertTitle>
                <AlertDescription>
                  Rows with errors below will not be imported. Fix them in Excel and re-upload, or proceed and only valid rows will be saved.
                </AlertDescription>
              </Alert>
            )}
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Staff</TableHead>
                    {DAYS.map((d) => <TableHead key={d} className="text-center">{d}</TableHead>)}
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsed.map((r, i) => (
                    <TableRow key={i} className={r.error ? 'bg-destructive/5' : ''}>
                      <TableCell>
                        <div className="font-medium text-sm">{r.name || '—'}</div>
                        <div className="text-xs text-muted-foreground">{r.staffId}</div>
                      </TableCell>
                      {r.shifts.map((s, idx) => (
                        <TableCell key={idx} className="text-center">
                          {s ? <Badge variant="outline">{s}</Badge> : <span className="text-muted-foreground">—</span>}
                        </TableCell>
                      ))}
                      <TableCell>
                        {r.error ? (
                          <span className="text-xs text-destructive">{r.error}</span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-[hsl(var(--success,142_71%_45%))]">
                            <CheckCircle2 className="h-3.5 w-3.5" /> Ready
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
