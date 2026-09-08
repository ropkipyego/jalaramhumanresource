import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useRole } from "@/hooks/useRole";
import { apiRequest } from "@/lib/api-client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { PasswordInput } from "@/components/ui/password-input";
import { toast } from "sonner";
import { KeyRound, Loader2, ShieldAlert } from "lucide-react";
import { DEFAULT_TEMP_PASSWORD, isTempPassword } from "@/lib/tempPassword";

export default function ChangePassword() {
  const { user, profile, loading, refreshProfile } = useAuth();
  const { isSuperAdmin } = useRole();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  const mustChange = !!(profile as any)?.must_change_password;

  useEffect(() => {
    if (!loading && !user) navigate("/auth", { replace: true });
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!loading && user && profile && !mustChange) {
      navigate(isSuperAdmin ? "/dashboard" : "/my-profile", { replace: true });
    }
  }, [user, profile, loading, mustChange, isSuperAdmin, navigate]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)) {
      toast.error("Use upper, lower, and a number");
      return;
    }
    if (isTempPassword(password)) {
      toast.error(`Choose a password other than ${DEFAULT_TEMP_PASSWORD}`);
      return;
    }
    if (password !== confirm) {
      toast.error("Passwords do not match");
      return;
    }
    setBusy(true);
    try {
      await apiRequest("/auth/change-password", {
        method: "POST",
        body: JSON.stringify({ newPassword: password }),
      });
      await refreshProfile?.();
      toast.success("Password updated — complete your profile next");
      navigate(isSuperAdmin ? "/dashboard" : "/my-profile", { replace: true });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update password");
    } finally {
      setBusy(false);
    }
  };

  if (loading || !user) {
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
            <KeyRound className="h-5 w-5" /> Set a new password
          </CardTitle>
          <CardDescription>
            Your account uses a temporary password ({DEFAULT_TEMP_PASSWORD}). Choose your own password before continuing.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert className="mb-4">
            <ShieldAlert className="h-4 w-4" />
            <AlertTitle>First login — required</AlertTitle>
            <AlertDescription>
              At least 8 characters, with uppercase, lowercase, and a number. After this you will complete your profile and upload documents.
            </AlertDescription>
          </Alert>
          <form onSubmit={save} className="space-y-4">
            <div>
              <Label>New password</Label>
              <PasswordInput
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <div>
              <Label>Confirm password</Label>
              <PasswordInput
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save &amp; continue
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
