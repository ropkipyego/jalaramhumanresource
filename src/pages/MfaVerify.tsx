import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2, Shield } from "lucide-react";

export default function MfaVerify() {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const [factorId, setFactorId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate("/auth", { replace: true });
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error) {
        toast.error(error.message);
        return;
      }
      const verified = (data?.totp ?? []).filter((f) => f.status === "verified");
      if (verified.length === 0) {
        navigate("/mfa-setup", { replace: true });
        return;
      }
      setFactorId(verified[0].id);
      setReady(true);
    })();
  }, [user, navigate]);

  const verify = async (e: React.FormEvent) => {
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
    toast.success("Verified");
    navigate("/dashboard", { replace: true });
  };

  if (loading || !user || !ready) {
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
            <Shield className="h-5 w-5" /> Enter MFA code
          </CardTitle>
          <CardDescription>
            Open your authenticator app and enter the current 6-digit code to continue.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={verify} className="space-y-4">
            <div>
              <Label>Authentication code</Label>
              <Input
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                placeholder="000000"
                required
                autoFocus
              />
            </div>
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Verify &amp; continue
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
