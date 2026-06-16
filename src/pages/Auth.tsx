import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ClipboardList, Loader2, Mail, Lock, User as UserIcon, IdCard } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { z } from 'zod';

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

const signupSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  fullName: z.string().min(2, 'Full name is required'),
  staffId: z.string().min(1, 'Staff ID is required'),
});

export default function Auth() {
  const navigate = useNavigate();
  const { user, signIn, signUp } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [staffId, setStaffId] = useState('');

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
      const { error } = await signIn(email, password);
      if (error) {
        toast({
          title: 'Login Failed',
          description: error.message === 'Invalid login credentials'
            ? 'Invalid email or password. Please try again.'
            : error.message,
          variant: 'destructive',
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const v = signupSchema.safeParse({ email, password, fullName, staffId });
      if (!v.success) {
        toast({ title: 'Validation Error', description: v.error.errors[0].message, variant: 'destructive' });
        return;
      }
      const { error } = await signUp(email, password, fullName, staffId);
      if (error) {
        toast({ title: 'Signup Failed', description: error.message, variant: 'destructive' });
      } else {
        toast({
          title: 'Account Created',
          description: 'Your account has been created. An admin will assign your role and department.',
        });
        setAuthMode('login');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-accent/20 to-background p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="space-y-4 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-xl bg-primary shadow-lg">
            <ClipboardList className="h-8 w-8 text-primary-foreground" />
          </div>
          <div>
            <CardTitle className="text-2xl font-bold">Hospital Rota Manager</CardTitle>
            <CardDescription className="mt-1">
              Sign in to manage your shifts and leave
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="flex rounded-lg bg-muted p-1">
            <button
              type="button"
              onClick={() => setAuthMode('login')}
              className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                authMode === 'login' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => setAuthMode('signup')}
              className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                authMode === 'signup' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Create Account
            </button>
          </div>

          {authMode === 'login' ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="login-email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input id="login-email" type="email" placeholder="you@hospital.org" value={email} onChange={(e) => setEmail(e.target.value)} className="pl-10" required />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="login-password">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input id="login-password" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} className="pl-10" required />
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Signing in...</>) : 'Sign In'}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleSignup} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="signup-name">Full Name</Label>
                <div className="relative">
                  <UserIcon className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input id="signup-name" type="text" placeholder="Jane Doe" value={fullName} onChange={(e) => setFullName(e.target.value)} className="pl-10" required />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="signup-staffid">Staff ID</Label>
                <div className="relative">
                  <IdCard className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input id="signup-staffid" type="text" placeholder="JH-1234" value={staffId} onChange={(e) => setStaffId(e.target.value)} className="pl-10" required />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="signup-email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input id="signup-email" type="email" placeholder="you@hospital.org" value={email} onChange={(e) => setEmail(e.target.value)} className="pl-10" required />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="signup-password">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input id="signup-password" type="password" placeholder="At least 8 characters" value={password} onChange={(e) => setPassword(e.target.value)} className="pl-10" required />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                After signing up, an administrator will assign your role and department.
              </p>
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creating account...</>) : 'Create Account'}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
