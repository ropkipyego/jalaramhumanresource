import React, { useEffect, useState } from 'react';
import { Outlet, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { AppSidebar } from './AppSidebar';
import { AppHeader } from './AppHeader';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { Loader2 } from 'lucide-react';
import { resolveMfaGate, type MfaGateState } from '@/lib/mfa';

const MFA_PATHS = new Set(['/mfa-setup', '/mfa-verify', '/change-password']);

export function AppLayout() {
  const { user, profile, role, loading } = useAuth();
  const location = useLocation();
  const [mfa, setMfa] = useState<MfaGateState>({ status: 'loading' });

  useEffect(() => {
    if (loading || !user) {
      setMfa({ status: 'loading' });
      return;
    }
    if (!role) {
      // Role still loading — wait
      setMfa({ status: 'loading' });
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
  }, [user, role, loading, location.pathname]);

  if (loading || (user && (mfa.status === 'loading' || !role) && !MFA_PATHS.has(location.pathname))) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if ((profile as any)?.must_change_password && location.pathname !== '/change-password') {
    return <Navigate to="/change-password" replace />;
  }

  if (mfa.status === 'needs_enroll' && location.pathname !== '/mfa-setup') {
    return <Navigate to="/mfa-setup" replace />;
  }
  if (mfa.status === 'needs_verify' && location.pathname !== '/mfa-verify') {
    return <Navigate to="/mfa-verify" replace />;
  }

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <SidebarInset className="flex flex-col flex-1">
          <AppHeader />
          <main className="flex-1 overflow-auto p-6">
            <Outlet />
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
