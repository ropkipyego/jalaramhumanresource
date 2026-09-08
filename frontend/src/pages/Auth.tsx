import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PasswordInput } from '@/components/ui/password-input';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, Mail, Lock } from 'lucide-react';
import { BrandLogo } from '@/components/BrandLogo';
import { useToast } from '@/hooks/use-toast';
import { z } from 'zod';
import { STAFF_EMAIL_DOMAIN, isAllowedLoginEmail } from '@/lib/staffEmail';

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export default function Auth() {
  const navigate = useNavigate();
  const { user, signIn } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState<'login' | 'forgot'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  useEffect(() => {
    if (user) navigate('/dashboard', { replace: true });
  }, [user, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const v = loginSchema.safeParse({ email, password });
      if (!v.success) {
        toast({ title: 'Validation Error', description: v.error.errors[0].message, variant: 'destructive' });
        return;
      }
      const normalized = email.trim().toLowerCase();
      if (normalized.endsWith('@jalaramhr.local')) {
        toast({
          title: 'Placeholder email disabled',
          description: `Ask HR to replace your login with a @${STAFF_EMAIL_DOMAIN} address.`,
          variant: 'destructive',
        });
        return;
      }
      if (!isAllowedLoginEmail(normalized)) {
        toast({
          title: 'Email not allowed',
          description: `Use your @${STAFF_EMAIL_DOMAIN} staff address, or the platform admin login.`,
          variant: 'destructive',
        });
        return;
      }
      const { error } = await signIn(normalized, password);
      if (error) {
        toast({
          title: 'Login Failed',
          description: error.message.includes('Invalid')
            ? 'Invalid email or password. Ask HR or your system administrator to reset your password.'
            : error.message,
          variant: 'destructive',
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-accent/20 to-background p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="space-y-4 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center overflow-hidden rounded-xl bg-white shadow-lg ring-1 ring-border">
            <BrandLogo className="h-14 w-14" />
          </div>
          <div>
            <CardTitle className="text-2xl font-bold">Jalaram Hospital HR</CardTitle>
            <CardDescription className="mt-1">
              {mode === 'login'
                ? `Sign in with your hospital email (@${STAFF_EMAIL_DOMAIN})`
                : 'Password reset'}
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {mode === 'login' ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="login-email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="login-email"
                    type="email"
                    autoComplete="username"
                    placeholder={`you@${STAFF_EMAIL_DOMAIN}`}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="login-password">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground z-10" />
                  <PasswordInput
                    id="login-password"
                    autoComplete="current-password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  If HR reset your account, use the temporary password they gave you — you will be asked to set a new one.
                </p>
              </div>
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Signing in...</>) : 'Sign In'}
              </Button>
              <button
                type="button"
                className="w-full text-sm text-primary hover:underline"
                onClick={() => setMode('forgot')}
              >
                Forgot password?
              </button>
            </form>
          ) : (
            <div className="space-y-4">
              <Alert>
                <AlertTitle>Self-hosted password reset</AlertTitle>
                <AlertDescription className="text-sm space-y-2">
                  <p>
                    Passwords are managed on this server — not via Supabase or any cloud auth service.
                  </p>
                  <p>
                    Contact your HR administrator or system administrator to reset your password.
                    They can run the safe reset script on the server for your email address.
                  </p>
                </AlertDescription>
              </Alert>
              <button
                type="button"
                className="w-full text-sm text-muted-foreground hover:underline"
                onClick={() => setMode('login')}
              >
                Back to sign in
              </button>
            </div>
          )}
          <p className="text-center text-xs text-muted-foreground">
            Accounts are created by HR only. Self-registration is disabled.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
