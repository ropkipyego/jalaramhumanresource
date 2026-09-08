import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  apiRequest,
  getAccessToken,
  setAccessToken,
  setRefreshToken,
} from '@/lib/api-client';
import type { AppRole, Profile, Department, EmployeeDepartment } from '@/types/database';

/** Minimal user shape for self-hosted NestJS auth */
interface ApiUser {
  id: string;
  email: string;
}

interface AuthContextType {
  user: ApiUser | null;
  session: null;
  profile: Profile | null;
  role: AppRole | null;
  departments: (EmployeeDepartment & { department: Department })[];
  headDepartments: string[];
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, fullName: string, staffId: string) => Promise<{ error: Error | null }>;
  signInWithMagicLink: (email: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<ApiUser | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [departments, setDepartments] = useState<(EmployeeDepartment & { department: Department })[]>([]);
  const [headDepartments, setHeadDepartments] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchUserData = async (userId: string) => {
    try {
      const { data: profileData, error: profileErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (profileErr) {
        console.error('Profile load error:', profileErr.message);
      }
      if (profileData) {
        setProfile(profileData as Profile);
      } else {
        setProfile(null);
      }

      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .maybeSingle();

      if (roleData) {
        setRole(roleData.role as AppRole);
      } else {
        setRole('STAFF');
      }

      const { data: deptData } = await supabase
        .from('employee_departments')
        .select(`
          *,
          department:departments(*)
        `)
        .eq('employee_id', userId);

      if (deptData) {
        const typedDeptData = deptData as unknown as (EmployeeDepartment & { department: Department })[];
        setDepartments(typedDeptData);
        setHeadDepartments(
          typedDeptData
            .filter((d) => d.is_head)
            .map((d) => d.department_id)
        );
      } else {
        setDepartments([]);
        setHeadDepartments([]);
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
      setRole((r) => r ?? 'STAFF');
    }
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchUserData(user.id);
    }
  };

  useEffect(() => {
    const boot = async () => {
      const token = getAccessToken();
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const me = await apiRequest<{ id: string; email: string }>('/auth/me');
        setUser({ id: me.id, email: me.email });
        await fetchUserData(me.id);
      } catch {
        setAccessToken(null);
        setRefreshToken(null);
      } finally {
        setLoading(false);
      }
    };
    boot();
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      const result = await apiRequest<{
        accessToken: string;
        refreshToken: string;
        user: { id: string; email: string };
      }>(
        '/auth/login',
        { method: 'POST', body: JSON.stringify({ email, password }) },
        false,
      );
      setAccessToken(result.accessToken);
      setRefreshToken(result.refreshToken);
      setUser({ id: result.user.id, email: result.user.email });
      await fetchUserData(result.user.id);
      return { error: null };
    } catch (e) {
      return { error: e instanceof Error ? e : new Error('Login failed') };
    }
  };

  const signUp = async (_email: string, _password: string, _fullName: string, _staffId: string) => ({
    error: new Error('Public signup is disabled. Ask HR to invite you.'),
  });

  const signInWithMagicLink = async (_email: string) => ({
    error: new Error('Magic link login is not available on self-hosted mode.'),
  });

  const signOut = async () => {
    const refresh = localStorage.getItem('jalaram.refreshToken');
    try {
      await apiRequest('/auth/logout', {
        method: 'POST',
        body: JSON.stringify({ refreshToken: refresh }),
      }, false);
    } catch {
      /* ignore */
    }
    setAccessToken(null);
    setRefreshToken(null);
    setUser(null);
    setProfile(null);
    setRole(null);
    setDepartments([]);
    setHeadDepartments([]);
  };

  const value = {
    user,
    session: null,
    profile,
    role,
    departments,
    headDepartments,
    loading,
    signIn,
    signUp,
    signInWithMagicLink,
    signOut,
    refreshProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
