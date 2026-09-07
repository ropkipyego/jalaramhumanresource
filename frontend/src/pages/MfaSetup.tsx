import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "sonner";
import { Loader2, ShieldCheck } from "lucide-react";

export default function MfaSetup() {
  const { user, loading, role, signOut } = useAuth();
  const navigate = useNavigate();
  const [factorId, setFactorId] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [enrolling, setEnrolling] = useState(true);

  useEffect(() => {
    if (!loading && !user) navigate("/auth", { replace: true });
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      setEnrolling(true);
      // Unenroll unverified leftovers so re-enroll works cleanly
      const { data: existing } = await supabase.auth.mfa.listFactors();
      for (const f of existing?.totp ?? []) {
        if (f.status !== "verified") {
          await supabase.auth.mfa.unenroll({ factorId: f.id });
        }
      }
      const verified = (existing?.totp ?? []).filter((f) => f.status === "verified");
      if (verified.length > 0) {
        navigate("/mfa-verify", { replace: true });
        return;
      }
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "Jalaram HRPMS",
      });
      if (cancelled) return;
      if (error || !data) {
        toast.error(error?.message || "Could not start MFA enrollment");
        setEnrolling(false);
        return;
      }
      setFactorId(data.id);
      setQr(data.totp.qr_code);
      setSecret(data.totp.secret);
      setEnrolling(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [user, navigate]);

  const confirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!factorId || code.trim().length < 6) {
      toast.error("Enter the 6-digit code from your authenticator app");
      return;
    }
    setBusy(true);
    const { data: challenge, error: chErr } = await supabase.auth.mfa.challenge({ factorId });
    if (chErr || !challenge) {
      setBusy(false);
      toast.error(chErr?.message || "Challenge failed");
      return;
    }
    const { error } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challenge.id,
      code: code.trim(),
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("MFA enabled");
    navigate("/dashboard", { replace: true });
  };

  if (loading || !user || enrolling) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" /> Set up authenticator MFA
          </CardTitle>
          <CardDescription>
            {role} accounts require two-factor authentication. Scan the QR with Google Authenticator,
            Microsoft Authenticator, or Authy.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertTitle>Required for admins</AlertTitle>
            <AlertDescription>
              ADMIN, SUPER_ADMIN, and FINANCE_ADMIN must enroll MFA before using payroll and HR admin tools.
            </AlertDescription>
          </Alert>
          {qr ? (
            <div className="flex flex-col items-center gap-2">
              <img src={qr} alt="MFA QR code" className="h-48 w-48 rounded border bg-white p-2" />
              {secret && (
                <p className="text-xs text-muted-foreground break-all text-center">
                  Manual key: <code>{secret}</code>
                </p>
              )}
            </div>
          ) : null}
          <form onSubmit={confirm} className="space-y-4">
            <div>
              <Label>6-digit code</Label>
              <Input
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                placeholder="000000"
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Confirm &amp; continue
            </Button>
          </form>
          <Button variant="ghost" className="w-full" onClick={() => signOut()}>
            Sign out
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
