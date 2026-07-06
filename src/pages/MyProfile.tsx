import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { toast } from 'sonner';
import { Info, Loader2 } from 'lucide-react';

type Editable = {
  phone: string; address: string;
  next_of_kin_name: string; next_of_kin_phone: string;
  national_id: string; kra_pin: string; nssf_number: string; shif_number: string;
  practicing_license_no: string; license_expiry_date: string;
  bank_name: string; bank_branch: string; bank_account: string;
};

const EMPTY: Editable = {
  phone: '', address: '', next_of_kin_name: '', next_of_kin_phone: '',
  national_id: '', kra_pin: '', nssf_number: '', shif_number: '',
  practicing_license_no: '', license_expiry_date: '',
  bank_name: '', bank_branch: '', bank_account: '',
};

export default function MyProfile() {
  const { user, profile, refreshProfile } = useAuth() as any;
  const [form, setForm] = useState<Editable>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [readOnlyData, setReadOnlyData] = useState<any>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
      if (data) {
        setForm({
          phone: data.phone ?? '', address: data.address ?? '',
          next_of_kin_name: data.next_of_kin_name ?? '', next_of_kin_phone: data.next_of_kin_phone ?? '',
          national_id: data.national_id ?? '', kra_pin: data.kra_pin ?? '',
          nssf_number: data.nssf_number ?? '', shif_number: data.shif_number ?? '',
          practicing_license_no: data.practicing_license_no ?? '',
          license_expiry_date: data.license_expiry_date ?? '',
          bank_name: data.bank_name ?? '', bank_branch: data.bank_branch ?? '', bank_account: data.bank_account ?? '',
        });
        setReadOnlyData(data);
      }
      setLoading(false);
    })();
  }, [user]);

  const set = (k: keyof Editable) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const save = async () => {
    if (!user) return;
    setSaving(true);
    const payload: any = { ...form };
    if (!payload.license_expiry_date) payload.license_expiry_date = null;
    const { error } = await supabase.from('profiles').update(payload).eq('id', user.id);
    setSaving(false);
    if (error) toast.error(error.message);
    else { toast.success('Profile updated'); refreshProfile?.(); }
  };

  if (loading) return <div className="p-6 text-muted-foreground">Loading…</div>;

  return (
    <div className="space-y-6 p-6 max-w-4xl">
      <div>
        <h1 className="text-3xl font-bold">My Profile</h1>
        <p className="text-muted-foreground">Update your personal, statutory and banking details.</p>
      </div>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>What you can and can't change</AlertTitle>
        <AlertDescription>
          Staff ID, full name, email, role, department, salary and employment status can only be edited by HR / Admin.
          Everything below is yours to manage.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>Account (read-only)</CardTitle>
          <CardDescription>Managed by HR.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <ReadOnly label="Staff ID" value={readOnlyData?.staff_id} />
          <ReadOnly label="Full name" value={readOnlyData?.full_name} />
          <ReadOnly label="Email" value={readOnlyData?.email} />
          <ReadOnly label="Designation" value={readOnlyData?.designation} />
          <ReadOnly label="Employment type" value={readOnlyData?.employment_type} />
          <ReadOnly label="Date joined" value={readOnlyData?.date_joined} />
          <ReadOnly label="Basic salary" value={readOnlyData?.basic_salary ? `KES ${Number(readOnlyData.basic_salary).toLocaleString()}` : '—'} />
          <ReadOnly label="HR status" value={readOnlyData?.hr_status} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Contact</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <Field label="Phone" value={form.phone} onChange={set('phone')} />
          <Field label="Address" value={form.address} onChange={set('address')} />
          <Field label="Next of kin — name" value={form.next_of_kin_name} onChange={set('next_of_kin_name')} />
          <Field label="Next of kin — phone" value={form.next_of_kin_phone} onChange={set('next_of_kin_phone')} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Statutory & Compliance</CardTitle>
          <CardDescription>Required for payroll (PAYE, NSSF, SHIF, Housing Levy).</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <Field label="National ID" value={form.national_id} onChange={set('national_id')} />
          <Field label="KRA PIN" value={form.kra_pin} onChange={set('kra_pin')} placeholder="e.g. A012345678B" />
          <Field label="NSSF Number" value={form.nssf_number} onChange={set('nssf_number')} />
          <Field label="SHIF Number" value={form.shif_number} onChange={set('shif_number')} />
          <Field label="Practicing licence no." value={form.practicing_license_no} onChange={set('practicing_license_no')} />
          <Field label="Licence expiry" type="date" value={form.license_expiry_date} onChange={set('license_expiry_date')} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Banking (for salary payment)</CardTitle>
          <CardDescription>Used by Finance to generate the bank export file.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <Field label="Bank name" value={form.bank_name} onChange={set('bank_name')} />
          <Field label="Branch" value={form.bank_branch} onChange={set('bank_branch')} />
          <Field label="Account number" value={form.bank_account} onChange={set('bank_account')} />
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save changes
        </Button>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = 'text', placeholder }: {
  label: string; value: string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  type?: string; placeholder?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input type={type} value={value ?? ''} onChange={onChange} placeholder={placeholder} />
    </div>
  );
}

function ReadOnly({ label, value }: { label: string; value: any }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-muted-foreground">{label}</Label>
      <div className="h-10 rounded-md border bg-muted/40 px-3 flex items-center text-sm">
        {value ?? <span className="text-muted-foreground">—</span>}
      </div>
    </div>
  );
}
