import { useEffect, useMemo, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { addDays, format, parseISO, isBefore } from "date-fns";
import { useRole } from "@/hooks/useRole";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { AlertTriangle, FileWarning, Fingerprint, IdCard, Loader2, ShieldAlert } from "lucide-react";

interface StaffRow {
  id: string;
  staff_id: string;
  full_name: string;
  kra_pin: string | null;
  biometric_enroll_id: string | null;
  license_expiry_date: string | null;
  practicing_license_no: string | null;
  contract_end_date: string | null;
  is_active: boolean;
}

export default function ComplianceDashboard() {
  const { hasRole } = useRole();
  const canAccess = hasRole("ADMIN");
  const [rows, setRows] = useState<StaffRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!canAccess) return;
    (async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, staff_id, full_name, kra_pin, biometric_enroll_id, license_expiry_date, practicing_license_no, contract_end_date, is_active")
        .eq("is_active", true)
        .order("full_name");
      if (error) toast.error(error.message);
      setRows((data as StaffRow[]) || []);
      setLoading(false);
    })();
  }, [canAccess]);

  const today = new Date();
  const in60 = addDays(today, 60);
  const in30 = addDays(today, 30);

  const kpis = useMemo(() => {
    const licenseExpiring60 = rows.filter((r) =>
      r.license_expiry_date && !isBefore(parseISO(r.license_expiry_date), today) && isBefore(parseISO(r.license_expiry_date), in60)
    );
    const contractsExpiring30 = rows.filter((r) =>
      r.contract_end_date && !isBefore(parseISO(r.contract_end_date), today) && isBefore(parseISO(r.contract_end_date), in30)
    );
    const missingKra = rows.filter((r) => !r.kra_pin);
    const missingBio = rows.filter((r) => !r.biometric_enroll_id);
    const expiredLicenses = rows.filter((r) =>
      r.license_expiry_date && isBefore(parseISO(r.license_expiry_date), today)
    );
    return { licenseExpiring60, contractsExpiring30, missingKra, missingBio, expiredLicenses };
  }, [rows]);

  const atRisk = useMemo(() => {
    const ids = new Set([
      ...kpis.licenseExpiring60, ...kpis.contractsExpiring30,
      ...kpis.missingKra, ...kpis.missingBio, ...kpis.expiredLicenses,
    ].map((r) => r.id));
    return rows.filter((r) => ids.has(r.id));
  }, [rows, kpis]);

  if (!canAccess) return <Navigate to="/dashboard" replace />;
  if (loading) return <div className="flex justify-center h-64 items-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;

  const cards = [
    { label: "Licenses expiring (60d)", value: kpis.licenseExpiring60.length, icon: FileWarning },
    { label: "Contracts expiring (30d)", value: kpis.contractsExpiring30.length, icon: AlertTriangle },
    { label: "Missing KRA PIN", value: kpis.missingKra.length, icon: IdCard },
    { label: "Missing biometric", value: kpis.missingBio.length, icon: Fingerprint },
    { label: "Expired licenses", value: kpis.expiredLicenses.length, icon: ShieldAlert },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Compliance Dashboard</h1>
        <p className="text-muted-foreground">Licenses, contracts, and payroll readiness risks.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {cards.map((c) => (
          <Card key={c.label}>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-1"><c.icon className="h-3.5 w-3.5" />{c.label}</CardDescription>
              <CardTitle className="text-3xl">{c.value}</CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>At-risk staff</CardTitle>
          <CardDescription>{atRisk.length} employee{atRisk.length !== 1 ? "s" : ""} need attention</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>KRA</TableHead>
                <TableHead>Biometric</TableHead>
                <TableHead>License expiry</TableHead>
                <TableHead>Contract end</TableHead>
                <TableHead>Flags</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {atRisk.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">All clear.</TableCell></TableRow>
              ) : atRisk.map((r) => {
                const flags: string[] = [];
                if (!r.kra_pin) flags.push("No KRA");
                if (!r.biometric_enroll_id) flags.push("No bio");
                if (r.license_expiry_date && isBefore(parseISO(r.license_expiry_date), today)) flags.push("License expired");
                else if (r.license_expiry_date && isBefore(parseISO(r.license_expiry_date), in60)) flags.push("License soon");
                if (r.contract_end_date && isBefore(parseISO(r.contract_end_date), in30) && !isBefore(parseISO(r.contract_end_date), today)) flags.push("Contract soon");
                return (
                  <TableRow key={r.id}>
                    <TableCell>
                      <Link to={`/staff/${r.id}`} className="font-medium text-primary hover:underline">{r.full_name}</Link>
                      <div className="text-xs text-muted-foreground">{r.staff_id}</div>
                    </TableCell>
                    <TableCell>{r.kra_pin || <Badge variant="destructive">Missing</Badge>}</TableCell>
                    <TableCell>{r.biometric_enroll_id || <Badge variant="destructive">Missing</Badge>}</TableCell>
                    <TableCell>{r.license_expiry_date ? format(parseISO(r.license_expiry_date), "dd MMM yyyy") : "—"}</TableCell>
                    <TableCell>{r.contract_end_date ? format(parseISO(r.contract_end_date), "dd MMM yyyy") : "—"}</TableCell>
                    <TableCell className="space-x-1">{flags.map((f) => <Badge key={f} variant="secondary">{f}</Badge>)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
