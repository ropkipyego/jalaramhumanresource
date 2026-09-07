import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRole } from '@/hooks/useRole';
import { supabase } from '@/integrations/supabase/client';
import type { Department } from '@/types/database';

/**
 * Returns the list of departments the current user can manage / view rotas for.
 *  - ADMIN / SUPER_ADMIN: every active department in the database.
 *  - HEAD: departments they are head of.
 *  - STAFF: their own assigned departments (read-only views).
 */
export function useManageableDepartments() {
  const { departments: userDepartments } = useAuth();
  const { hasRole, headDepartments } = useRole();
  const [allDepartments, setAllDepartments] = useState<Department[] | null>(null);
  const [loading, setLoading] = useState(false);

  const isAdmin = hasRole('ADMIN');

  useEffect(() => {
    if (!isAdmin) {
      setAllDepartments(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    supabase
      .from('departments')
      .select('*')
      .eq('is_active', true)
      .order('name')
      .then(({ data }) => {
        if (!cancelled) {
          setAllDepartments((data as Department[]) || []);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [isAdmin]);

  const departments = useMemo<Department[]>(() => {
    if (isAdmin && allDepartments) return allDepartments;
    if (hasRole('HEAD')) {
      return userDepartments
        .filter((d) => headDepartments.includes(d.department_id))
        .map((d) => d.department);
    }
    return userDepartments.map((d) => d.department);
  }, [isAdmin, allDepartments, userDepartments, headDepartments, hasRole]);

  return { departments, loading, isAdmin };
}
