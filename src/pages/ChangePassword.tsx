import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "sonner";
import { KeyRound, Loader2, ShieldAlert } from "lucide-react";

export default function ChangePassword() {
  const { user, loading, refreshProfile } = useAuth() as any;
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate("/auth", { replace: true });
  }, [user, loading, navigate]);

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
    if (password !== confirm) {
      toast.error("Passwords do not match");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setBusy(false);
      toast.error(error.message);
      return;
    }
    if (user?.id) {
      await (supabase as any).rpc("set_must_change_password", { _user_id: user.id, _value: false });
      await supabase.from("profiles").update({ must_change_password: false } as any).eq("id", user.id);
    }
    await refreshProfile?.();
    setBusy(false);
    toast.success("Password updated");
    navigate("/dashboard", { replace: true });
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
            For security, you must choose your own password before using the system.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert className="mb-4">
            <ShieldAlert className="h-4 w-4" />
            <AlertTitle>Password rules</AlertTitle>
            <AlertDescription>
              At least 8 characters, with uppercase, lowercase, and a number.
            </AlertDescription>
          </Alert>
          <form onSubmit={save} className="space-y-4">
            <div>
              <Label>New password</Label>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            <div>
              <Label>Confirm password</Label>
              <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
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
