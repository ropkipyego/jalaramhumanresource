import React, { useEffect, useState } from 'react';
import { Outlet, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { AppSidebar } from './AppSidebar';
import { AppHeader } from './AppHeader';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { Loader2 } from 'lucide-react';
import { resolveMfaGate, type MfaGateState } from '@/lib/mfa';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

export function AppLayout() {
  const { user, profile, role, loading, signOut } = useAuth();
  const location = useLocation();
  const [mfa, setMfa] = useState<MfaGateState>({ status: 'loading' });

  const mustChange = !!(profile as any)?.must_change_password;
  // Only treat explicit false / TERMINATED as closed — null/undefined is_active must not block login
  const inactive =
    !!profile &&
    ((profile as any).is_active === false || String((profile as any).hr_status || "") === "TERMINATED");

  useEffect(() => {
    if (loading || !user || mustChange || inactive) {
      setMfa({ status: 'ok' });
      return;
    }
    let cancelled = false;
    setMfa({ status: 'loading' });
    resolveMfaGate(role).then((state) => {
      if (!cancelled) setMfa(state);
    });
    return () => {
      cancelled = true;
    };
  }, [user, role, loading, mustChange, inactive, location.pathname]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4 animate-fade-in">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (inactive) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6 bg-background">
        <Alert className="max-w-md animate-fade-in">
          <AlertTitle>Account closed</AlertTitle>
          <AlertDescription className="space-y-3">
            <p>
              This staff account is inactive or offboarded. The employment record is kept for HR history —
              contact HR if this is a mistake.
            </p>
            <Button variant="outline" onClick={() => signOut()}>Sign out</Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (mustChange) {
    return <Navigate to="/change-password" replace />;
  }

  if (mfa.status === 'loading') {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (mfa.status === 'needs_verify' && location.pathname !== '/mfa-verify') {
    return <Navigate to="/mfa-verify" replace />;
  }
  if (mfa.status === 'needs_enroll' && location.pathname !== '/mfa-setup') {
    return <Navigate to="/mfa-setup" replace />;
  }

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <SidebarInset className="flex flex-col flex-1">
          <AppHeader />
          <main className="flex-1 overflow-auto p-6 animate-fade-in">
            <Outlet />
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
