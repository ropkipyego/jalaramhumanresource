import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import type { AppRole, Profile, Department, EmployeeDepartment } from '@/types/database';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  role: AppRole | null;
  departments: (EmployeeDepartment & { department: Department })[];
  headDepartments: string[]; // department IDs where user is head
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, fullName: string, staffId: string) => Promise<{ error: Error | null }>;
  signInWithMagicLink: (email: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [departments, setDepartments] = useState<(EmployeeDepartment & { department: Department })[]>([]);
  const [headDepartments, setHeadDepartments] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchUserData = async (userId: string) => {
    try {
      // Fetch profile
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
        // Avoid hanging gates when profile row is missing
        setProfile(null);
      }

      // Fetch role
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .maybeSingle();

      if (roleData) {
        setRole(roleData.role as AppRole);
      } else {
        // Never leave role null forever — AppLayout used to hang on login
        setRole('STAFF');
      }

      // Fetch departments
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
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          setLoading(true);
          // Defer Supabase calls with setTimeout
          setTimeout(() => {
            fetchUserData(session.user.id).finally(() => setLoading(false));
          }, 0);
        } else {
          setProfile(null);
          setRole(null);
          setDepartments([]);
          setHeadDepartments([]);
          setLoading(false);
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        fetchUserData(session.user.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  };

  const signUp = async (_email: string, _password: string, _fullName: string, _staffId: string) => {
    // Invite-only: accounts are created by Admin via Staff Invite / bulk / go-live edge functions.
    return {
      error: {
        message: "Public signup is disabled. Ask HR to invite you with your @jalaram.co.ke email.",
        name: "AuthApiError",
        status: 403,
      } as any,
    };
  };

  const signInWithMagicLink = async (email: string) => {
    const redirectUrl = `${window.location.origin}/`;
    
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: redirectUrl,
      },
    });
    
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
    setRole(null);
    setDepartments([]);
    setHeadDepartments([]);
  };

  const value = {
    user,
    session,
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