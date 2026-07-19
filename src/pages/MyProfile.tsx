import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { FolderOpen, Info, Loader2 } from 'lucide-react';
import { phasePercent, profileCompleteness } from '@/lib/profileCompleteness';
import { ProfileDocUpload } from '@/components/profile/ProfileDocUpload';

type Editable = {
  phone: string;
  address: string;
  next_of_kin_name: string;
  next_of_kin_phone: string;
  national_id: string;
  kra_pin: string;
  nssf_number: string;
  shif_number: string;
  practicing_license_no: string;
  license_expiry_date: string;
  bank_name: string;
  bank_branch: string;
  bank_account: string;
};

const EMPTY: Editable = {
  phone: '',
  address: '',
  next_of_kin_name: '',
  next_of_kin_phone: '',
  national_id: '',
  kra_pin: '',
  nssf_number: '',
  shif_number: '',
  practicing_license_no: '',
  license_expiry_date: '',
  bank_name: '',
  bank_branch: '',
  bank_account: '',
};

export default function MyProfile() {
  const { user, refreshProfile } = useAuth() as any;
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
          phone: data.phone ?? '',
          address: data.address ?? '',
          next_of_kin_name: data.next_of_kin_name ?? '',
          next_of_kin_phone: data.next_of_kin_phone ?? '',
          national_id: data.national_id ?? '',
          kra_pin: data.kra_pin ?? '',
          nssf_number: data.nssf_number ?? '',
          shif_number: data.shif_number ?? '',
          practicing_license_no: data.practicing_license_no ?? '',
          license_expiry_date: data.license_expiry_date ?? '',
          bank_name: data.bank_name ?? '',
          bank_branch: data.bank_branch ?? '',
          bank_account: data.bank_account ?? '',
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
    else {
      toast.success('Profile saved');
      setReadOnlyData((d: any) => (d ? { ...d, ...payload } : d));
      refreshProfile?.();
    }
  };

  if (loading) return <div className="p-6 text-muted-foreground">Loading…</div>;

  const merged = { ...readOnlyData, ...form };
  const c = profileCompleteness(merged);
  const contactPct = phasePercent(merged, 'Contact');
  const statutoryPct = phasePercent(merged, 'Statutory');
  const licensePct = phasePercent(merged, 'License');
  const bankPct = phasePercent(merged, 'Bank');

  return (
    <div className="space-y-6 p-6 max-w-3xl">
      <div>
        <h1 className="text-3xl font-bold">My Profile</h1>
        <p className="text-muted-foreground">
          Complete your details in steps. Salary is filled by HR only.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Your progress — {c.staffPercent}%</CardTitle>
          <CardDescription>
            Contact {contactPct}% · Statutory {statutoryPct}% · License {licensePct}% · Bank {bankPct}%
            {c.hrPercent < 100 ? ` · HR still needs: ${c.hrMissing.join(', ') || '—'}` : ' · HR section complete'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Progress value={c.staffPercent} className="h-2" />
        </CardContent>
      </Card>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>Two parts</AlertTitle>
        <AlertDescription className="text-sm space-y-1">
          <p><strong>You:</strong> contact, KRA / NSSF / SHIF, license, bank — and upload supporting files.</p>
          <p><strong>HR:</strong> basic salary and job details.</p>
          <Button asChild variant="link" className="h-auto p-0">
            <Link to="/my-documents"><FolderOpen className="h-3.5 w-3.5 mr-1 inline" />All documents</Link>
          </Button>
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>Account (read-only)</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <ReadOnly label="Staff ID" value={readOnlyData?.staff_id} />
          <ReadOnly label="Full name" value={readOnlyData?.full_name} />
          <ReadOnly label="Email" value={readOnlyData?.email} />
          <ReadOnly label="Designation" value={readOnlyData?.designation} />
        </CardContent>
      </Card>

      {/* Phase 1 — Contact */}
      <Card>
        <CardHeader>
          <CardTitle>1. Contact ({contactPct}%)</CardTitle>
          <CardDescription>How we reach you and your next of kin.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <Field label="Phone" value={form.phone} onChange={set('phone')} />
          <Field label="Address" value={form.address} onChange={set('address')} />
          <Field label="Next of kin — name" value={form.next_of_kin_name} onChange={set('next_of_kin_name')} />
          <Field label="Next of kin — phone" value={form.next_of_kin_phone} onChange={set('next_of_kin_phone')} />
        </CardContent>
      </Card>

      {/* Phase 2 — Statutory */}
      <Card>
        <CardHeader>
          <CardTitle>2. Statutory IDs ({statutoryPct}%)</CardTitle>
          <CardDescription>KRA, NSSF, SHIF and National ID — required for payroll deductions.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="National ID" value={form.national_id} onChange={set('national_id')} />
            <Field label="KRA PIN" value={form.kra_pin} onChange={set('kra_pin')} placeholder="e.g. A012345678B" />
            <Field label="NSSF Number" value={form.nssf_number} onChange={set('nssf_number')} />
            <Field label="SHIF Number" value={form.shif_number} onChange={set('shif_number')} />
          </div>
          <div className="space-y-3 rounded-md border p-3">
            <p className="text-sm font-medium">Upload copies (PDF or photo)</p>
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">National ID</p>
              <ProfileDocUpload docType="ID_COPY" title="National ID copy" />
            </div>
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">KRA PIN certificate</p>
              <ProfileDocUpload docType="KRA_PIN" title="KRA PIN document" />
            </div>
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">NSSF card / statement</p>
              <ProfileDocUpload docType="NSSF" title="NSSF document" />
            </div>
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">SHIF card / statement</p>
              <ProfileDocUpload docType="SHIF" title="SHIF document" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Phase 3 — License */}
      <Card>
        <CardHeader>
          <CardTitle>3. Practicing license ({licensePct}%)</CardTitle>
          <CardDescription>For clinical / licensed roles. Leave blank if not applicable — ask HR.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="License number" value={form.practicing_license_no} onChange={set('practicing_license_no')} />
            <Field label="License expiry" type="date" value={form.license_expiry_date} onChange={set('license_expiry_date')} />
          </div>
          <div className="space-y-2 rounded-md border p-3">
            <p className="text-sm font-medium">Upload license</p>
            <ProfileDocUpload docType="LICENSE" title="Practicing license" label="Upload license file" />
          </div>
        </CardContent>
      </Card>

      {/* Phase 4 — Bank */}
      <Card>
        <CardHeader>
          <CardTitle>4. Bank details ({bankPct}%)</CardTitle>
          <CardDescription>Where your salary is paid.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <Field label="Bank name" value={form.bank_name} onChange={set('bank_name')} />
            <Field label="Branch" value={form.bank_branch} onChange={set('bank_branch')} />
            <Field label="Account number" value={form.bank_account} onChange={set('bank_account')} />
          </div>
          <div className="space-y-2 rounded-md border p-3">
            <p className="text-sm font-medium">Upload bank proof (statement or card photo)</p>
            <ProfileDocUpload docType="BANK_PROOF" title="Bank account proof" label="Upload bank proof" />
          </div>
        </CardContent>
      </Card>

      {/* HR-only */}
      <Card>
        <CardHeader>
          <CardTitle>HR only — salary</CardTitle>
          <CardDescription>Contact HR if this needs correcting.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <ReadOnly
            label="Basic salary"
            value={
              readOnlyData?.basic_salary
                ? `KES ${Number(readOnlyData.basic_salary).toLocaleString()}`
                : null
            }
          />
          <ReadOnly label="Date joined" value={readOnlyData?.date_joined} />
          <ReadOnly label="HR status" value={readOnlyData?.hr_status} />
        </CardContent>
      </Card>

      <div className="flex justify-end sticky bottom-4">
        <Button onClick={save} disabled={saving} size="lg">
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save all details
        </Button>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  type?: string;
  placeholder?: string;
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
        {value ? String(value) : <span className="text-muted-foreground">Not set — ask HR</span>}
      </div>
    </div>
  );
}
