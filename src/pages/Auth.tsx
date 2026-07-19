import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PasswordInput } from '@/components/ui/password-input';
import { ClipboardList, Loader2, Mail, Lock, KeyRound } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { z } from 'zod';
import { STAFF_EMAIL_DOMAIN } from '@/lib/staffEmail';

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
  const [resetSent, setResetSent] = useState(false);

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
          description: 'Ask HR to replace your login with a @jalaram.co.ke address.',
          variant: 'destructive',
        });
        return;
      }
      if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY) {
        toast({
          title: 'App not connected to Supabase',
          description: 'Missing VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY on this deploy (set them in Vercel → Environment Variables).',
          variant: 'destructive',
        });
        return;
      }
      const { error } = await signIn(normalized, password);
      if (error) {
        toast({
          title: 'Login Failed',
          description: error.message === 'Invalid login credentials'
            ? 'Invalid email or password. Ask HR if you need a password reset.'
            : error.message,
          variant: 'destructive',
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalized = email.trim().toLowerCase();
    if (!normalized.includes('@')) {
      toast({ title: 'Enter your email', variant: 'destructive' });
      return;
    }
    setIsLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(normalized, {
      redirectTo: `${window.location.origin}/change-password`,
    });
    setIsLoading(false);
    if (error) {
      toast({ title: 'Could not send reset email', description: error.message, variant: 'destructive' });
      return;
    }
    setResetSent(true);
    toast({
      title: 'Check your email',
      description: 'If that address has an account, a reset link was sent. SMTP must be configured in Supabase Auth.',
    });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-accent/20 to-background p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="space-y-4 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-xl bg-primary shadow-lg">
            <ClipboardList className="h-8 w-8 text-primary-foreground" />
          </div>
          <div>
            <CardTitle className="text-2xl font-bold">Jalaram Hospital HR</CardTitle>
            <CardDescription className="mt-1">
              {mode === 'login'
                ? `Sign in with your @${STAFF_EMAIL_DOMAIN} account`
                : 'Reset your password'}
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
                onClick={() => { setMode('forgot'); setResetSent(false); }}
              >
                Forgot password?
              </button>
            </form>
          ) : (
            <form onSubmit={handleForgot} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="reset-email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="reset-email"
                    type="email"
                    placeholder={`you@${STAFF_EMAIL_DOMAIN}`}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
              </div>
              {resetSent && (
                <p className="text-sm text-muted-foreground flex items-start gap-2">
                  <KeyRound className="h-4 w-4 mt-0.5 shrink-0" />
                  Reset link sent (if the account exists). Also ask HR to set password to ChangeMe123! from Go-Live Credentials.
                </p>
              )}
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Sending...</>) : 'Send reset link'}
              </Button>
              <button
                type="button"
                className="w-full text-sm text-muted-foreground hover:underline"
                onClick={() => setMode('login')}
              >
                Back to sign in
              </button>
            </form>
          )}
          <p className="text-center text-xs text-muted-foreground">
            Accounts are created by HR only. Self-registration is disabled.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
