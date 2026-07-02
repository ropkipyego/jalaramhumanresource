import React, { useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useRole } from '@/hooks/useRole';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { Search, Edit, ShieldCheck, ShieldAlert } from 'lucide-react';
import type { EmploymentType, HrStatus } from '@/types/database';
import { z } from 'zod';

interface StaffRow {
  id: string;
  staff_id: string;
  full_name: string;
  email: string;
  designation: string | null;
  employment_type: EmploymentType | null;
  hr_status: HrStatus;
  kra_pin: string | null;
  nssf_number: string | null;
  shif_number: string | null;
  national_id: string | null;
  basic_salary: number | null;
  date_joined: string | null;
  contract_end_date: string | null;
  practicing_license_no: string | null;
  license_expiry_date: string | null;
}

const complianceSchema = z.object({
  national_id: z.string().trim().max(20).optional().or(z.literal('')),
  kra_pin: z.string().trim().regex(/^[A-Z]\d{9}[A-Z]$/i, 'KRA PIN format: A123456789Z').optional().or(z.literal('')),
  nssf_number: z.string().trim().max(30).optional().or(z.literal('')),
  shif_number: z.string().trim().max(30).optional().or(z.literal('')),
  designation: z.string().trim().max(100).optional().or(z.literal('')),
  employment_type: z.enum(['PERMANENT','CONTRACT','LOCUM','INTERN']).optional(),
  hr_status: z.enum(['ACTIVE','SUSPENDED','ON_LEAVE','TERMINATED']),
  basic_salary: z.coerce.number().min(0).max(99999999).optional(),
  date_joined: z.string().optional().or(z.literal('')),
  contract_end_date: z.string().optional().or(z.literal('')),
  practicing_license_no: z.string().trim().max(50).optional().or(z.literal('')),
  license_expiry_date: z.string().optional().or(z.literal('')),
});

export default function StaffCompliance() {
  const { canViewPayroll } = useRole();
  const [rows, setRows] = useState<StaffRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<StaffRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Partial<StaffRow>>({});

  const fetchAll = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('id, staff_id, full_name, email, designation, employment_type, hr_status, kra_pin, nssf_number, shif_number, national_id, basic_salary, date_joined, contract_end_date, practicing_license_no, license_expiry_date')
      .order('full_name');
    if (error) toast.error(error.message);
    setRows((data as StaffRow[]) || []);
    setLoading(false);
  };

  useEffect(() => { if (canViewPayroll) fetchAll(); }, [canViewPayroll]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((r) =>
      r.full_name?.toLowerCase().includes(s) ||
      r.staff_id?.toLowerCase().includes(s) ||
      r.email?.toLowerCase().includes(s)
    );
  }, [rows, q]);

  const missingCount = rows.filter((r) => !r.kra_pin || !r.basic_salary).length;

  if (!canViewPayroll) return <Navigate to="/dashboard" replace />;

  const openEdit = (row: StaffRow) => {
    setEditing(row);
    setForm({ ...row });
  };

  const save = async () => {
    if (!editing) return;
    const parsed = complianceSchema.safeParse(form);
    if (!parsed.success) {
      const first = Object.values(parsed.error.flatten().fieldErrors)[0]?.[0];
      toast.error(first || 'Invalid input');
      return;
    }
    setSaving(true);
    const payload: Record<string, unknown> = {};
    (Object.keys(parsed.data) as (keyof typeof parsed.data)[]).forEach((k) => {
      const v = (parsed.data as Record<string, unknown>)[k];
      payload[k] = v === '' ? null : v;
    });
    const { error } = await supabase.from('profiles').update(payload).eq('id', editing.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success('Compliance data saved');
    setEditing(null);
    fetchAll();
  };

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <ShieldCheck className="h-7 w-7 text-primary" /> Staff Compliance & Payroll Data
        </h1>
        <p className="text-muted-foreground">
          Capture KRA PIN, NSSF, SHIF, employment type and basic salary. Required for Phase 2 payroll runs.
        </p>
      </div>

      {missingCount > 0 && (
        <Alert>
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>{missingCount} staff missing KRA PIN or basic salary</AlertTitle>
          <AlertDescription>
            These employees will be excluded from Phase 2 payroll runs until the missing fields are provided.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Staff</CardTitle>
          <CardDescription>Every edit to basic salary is written to the payroll audit log.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, staff ID or email"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="pl-9"
            />
          </div>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (
            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Staff ID</TableHead>
                    <TableHead>Designation</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>KRA PIN</TableHead>
                    <TableHead>Basic salary (KES)</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Edit</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.full_name}</TableCell>
                      <TableCell>{r.staff_id}</TableCell>
                      <TableCell>{r.designation || '—'}</TableCell>
                      <TableCell>{r.employment_type || '—'}</TableCell>
                      <TableCell>
                        {r.kra_pin || <Badge variant="destructive">Missing</Badge>}
                      </TableCell>
                      <TableCell>
                        {r.basic_salary != null ? Number(r.basic_salary).toLocaleString() : <Badge variant="destructive">Missing</Badge>}
                      </TableCell>
                      <TableCell><Badge variant="outline">{r.hr_status}</Badge></TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="outline" onClick={() => openEdit(r)}>
                          <Edit className="h-3 w-3 mr-1" /> Edit
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing?.full_name}</DialogTitle>
            <DialogDescription>Compliance & payroll data. Every salary edit is audited.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 py-2">
            <Field label="National ID" value={form.national_id ?? ''} onChange={(v) => setForm({ ...form, national_id: v })} />
            <Field label="KRA PIN" value={form.kra_pin ?? ''} onChange={(v) => setForm({ ...form, kra_pin: v.toUpperCase() })} placeholder="A123456789Z" />
            <Field label="NSSF No." value={form.nssf_number ?? ''} onChange={(v) => setForm({ ...form, nssf_number: v })} />
            <Field label="SHIF No." value={form.shif_number ?? ''} onChange={(v) => setForm({ ...form, shif_number: v })} />
            <Field label="Designation" value={form.designation ?? ''} onChange={(v) => setForm({ ...form, designation: v })} />
            <div>
              <label className="text-sm font-medium mb-1 block">Employment Type</label>
              <Select
                value={form.employment_type ?? undefined}
                onValueChange={(v) => setForm({ ...form, employment_type: v as EmploymentType })}
              >
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  {(['PERMANENT','CONTRACT','LOCUM','INTERN'] as EmploymentType[]).map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">HR Status</label>
              <Select
                value={form.hr_status ?? 'ACTIVE'}
                onValueChange={(v) => setForm({ ...form, hr_status: v as HrStatus })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(['ACTIVE','SUSPENDED','ON_LEAVE','TERMINATED'] as HrStatus[]).map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Field label="Basic Salary (KES)" type="number" value={form.basic_salary?.toString() ?? ''} onChange={(v) => setForm({ ...form, basic_salary: v === '' ? null : Number(v) })} />
            <Field label="Date Joined" type="date" value={form.date_joined ?? ''} onChange={(v) => setForm({ ...form, date_joined: v })} />
            <Field label="Contract End" type="date" value={form.contract_end_date ?? ''} onChange={(v) => setForm({ ...form, contract_end_date: v })} />
            <Field label="Practicing License No." value={form.practicing_license_no ?? ''} onChange={(v) => setForm({ ...form, practicing_license_no: v })} />
            <Field label="License Expiry" type="date" value={form.license_expiry_date ?? ''} onChange={(v) => setForm({ ...form, license_expiry_date: v })} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, value, onChange, type = 'text', placeholder }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string;
}) {
  return (
    <div>
      <label className="text-sm font-medium mb-1 block">{label}</label>
      <Input type={type} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
