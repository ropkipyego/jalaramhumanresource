import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRole } from '@/hooks/useRole';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Calendar } from 'lucide-react';
import { format, startOfWeek, addWeeks, subWeeks } from 'date-fns';
import { toast } from 'sonner';

import { WeekNavigator } from '@/components/rota/WeekNavigator';
import { DepartmentSelector } from '@/components/rota/DepartmentSelector';
import { RotaGrid } from '@/components/rota/RotaGrid';
import { ValidationPanel } from '@/components/rota/ValidationPanel';
import { useRotaValidation } from '@/hooks/useRotaValidation';
import { useManageableDepartments } from '@/hooks/useManageableDepartments';

import type {
  Department,
  Profile,
  RotaWeek,
  RotaAssignment,
  ShiftCode,
  DepartmentRules,
  LeaveRequest,
} from '@/types/database';

export default function DepartmentRota() {
  const { user } = useAuth();
  const { hasRole } = useRole();
  const { departments: manageableDepartments } = useManageableDepartments();

  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string | null>(null);
  const [currentWeekStart, setCurrentWeekStart] = useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );

  // Data state
  const [rotaWeek, setRotaWeek] = useState<RotaWeek | null>(null);
  const [employees, setEmployees] = useState<Profile[]>([]);
  const [assignments, setAssignments] = useState<Map<string, ShiftCode | null>>(new Map());
  const [originalAssignments, setOriginalAssignments] = useState<Map<string, ShiftCode | null>>(new Map());
  const [departmentRules, setDepartmentRules] = useState<DepartmentRules | null>(null);
  const [approvedLeaves, setApprovedLeaves] = useState<LeaveRequest[]>([]);
  const [previousWeekAssignments, setPreviousWeekAssignments] = useState<Map<string, ShiftCode | null>>(new Map());

  // Loading state
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);

  const selectedDepartment = manageableDepartments.find((d) => d.id === selectedDepartmentId);
  const isEditable = selectedDepartment ? hasRole('HEAD') || hasRole('ADMIN') : false;
  const hasChanges = useMemo(() => {
    if (assignments.size !== originalAssignments.size) return true;
    for (const [key, value] of assignments) {
      if (originalAssignments.get(key) !== value) return true;
    }
    return false;
  }, [assignments, originalAssignments]);

  // Validation
  const { blockers, warnings, canPublish } = useRotaValidation({
    assignments,
    employees,
    rules: departmentRules,
    weekStartDate: currentWeekStart,
    approvedLeaves,
    previousWeekAssignments,
  });

  // Set initial department
  useEffect(() => {
    if (manageableDepartments.length > 0 && !selectedDepartmentId) {
      setSelectedDepartmentId(manageableDepartments[0].id);
    }
  }, [manageableDepartments, selectedDepartmentId]);

  // Fetch data when department or week changes
  useEffect(() => {
    if (selectedDepartmentId) {
      fetchData();
    }
  }, [selectedDepartmentId, currentWeekStart]);

  const fetchData = async () => {
    if (!selectedDepartmentId) return;
    setLoading(true);

    try {
      const weekStartStr = format(currentWeekStart, 'yyyy-MM-dd');
      const prevWeekStartStr = format(subWeeks(currentWeekStart, 1), 'yyyy-MM-dd');

      // Fetch all data in parallel
      const [employeesRes, rotaWeekRes, rulesRes, leavesRes, prevWeekRes] = await Promise.all([
        // Employees in department
        supabase
          .from('employee_departments')
          .select('employee:profiles(*)')
          .eq('department_id', selectedDepartmentId),

        // Current week rota
        supabase
          .from('rota_weeks')
          .select('*, rota_assignments(*)')
          .eq('department_id', selectedDepartmentId)
          .eq('week_start_date', weekStartStr)
          .maybeSingle(),

        // Department rules
        supabase
          .from('department_rules')
          .select('*')
          .eq('department_id', selectedDepartmentId)
          .maybeSingle(),

        // Approved leaves for the week
        supabase
          .from('leave_requests')
          .select('*')
          .eq('department_id', selectedDepartmentId)
          .eq('status', 'approved')
          .lte('start_date', format(addWeeks(currentWeekStart, 1), 'yyyy-MM-dd'))
          .gte('end_date', weekStartStr),

        // Previous week rota (for copy and validation)
        supabase
          .from('rota_weeks')
          .select('*, rota_assignments(*)')
          .eq('department_id', selectedDepartmentId)
          .eq('week_start_date', prevWeekStartStr)
          .maybeSingle(),
      ]);

      // Process employees
      if (employeesRes.data) {
        const empList = employeesRes.data
          .map((e) => (e.employee as unknown as Profile))
          .filter((e): e is Profile => e !== null && e.is_active);
        setEmployees(empList);
      }

      // Process current week
      if (rotaWeekRes.data) {
        const week = rotaWeekRes.data as unknown as RotaWeek & { rota_assignments: RotaAssignment[] };
        setRotaWeek({
          id: week.id,
          department_id: week.department_id,
          week_start_date: week.week_start_date,
          status: week.status,
          published_at: week.published_at,
          published_by: week.published_by,
          created_at: week.created_at,
          updated_at: week.updated_at,
        });

        const assignMap = new Map<string, ShiftCode | null>();
        week.rota_assignments?.forEach((a) => {
          assignMap.set(`${a.employee_id}-${a.day_of_week}`, a.shift_code);
        });
        setAssignments(assignMap);
        setOriginalAssignments(new Map(assignMap));
      } else {
        setRotaWeek(null);
        setAssignments(new Map());
        setOriginalAssignments(new Map());
      }

      // Process rules
      if (rulesRes.data) {
        setDepartmentRules(rulesRes.data as DepartmentRules);
      } else {
        // Default rules
        setDepartmentRules({
          id: '',
          department_id: selectedDepartmentId,
          min_staff_day: 2,
          min_staff_night: 1,
          max_consecutive_nights: 3,
          min_rest_hours: 11,
          created_at: '',
          updated_at: '',
        });
      }

      // Process leaves
      if (leavesRes.data) {
        setApprovedLeaves(leavesRes.data as LeaveRequest[]);
      }

      // Process previous week
      if (prevWeekRes.data) {
        const prevWeek = prevWeekRes.data as unknown as { rota_assignments: RotaAssignment[] };
        const prevMap = new Map<string, ShiftCode | null>();
        prevWeek.rota_assignments?.forEach((a) => {
          prevMap.set(`${a.employee_id}-${a.day_of_week}`, a.shift_code);
        });
        setPreviousWeekAssignments(prevMap);
      } else {
        setPreviousWeekAssignments(new Map());
      }
    } catch (error) {
      console.error('Error fetching rota data:', error);
      toast.error('Failed to load rota data');
    } finally {
      setLoading(false);
    }
  };

  const handleShiftChange = useCallback((employeeId: string, dayIndex: number, shift: ShiftCode | null) => {
    setAssignments((prev) => {
      const next = new Map(prev);
      const key = `${employeeId}-${dayIndex}`;
      if (shift === null) {
        next.delete(key);
      } else {
        next.set(key, shift);
      }
      return next;
    });
  }, []);

  const navigateWeek = (direction: 'prev' | 'next') => {
    setCurrentWeekStart((prev) =>
      direction === 'prev' ? subWeeks(prev, 1) : addWeeks(prev, 1)
    );
  };

  const goToCurrentWeek = () => {
    setCurrentWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }));
  };

  const copyPreviousWeek = () => {
    if (previousWeekAssignments.size === 0) {
      toast.error('No previous week data to copy');
      return;
    }
    setAssignments(new Map(previousWeekAssignments));
    toast.success('Copied shifts from previous week');
  };

  const saveRota = async () => {
    if (!selectedDepartmentId || !user) return;
    setIsSaving(true);

    try {
      const weekStartStr = format(currentWeekStart, 'yyyy-MM-dd');

      // Create or get rota week
      let weekId = rotaWeek?.id;
      if (!weekId) {
        const { data: newWeek, error: weekError } = await supabase
          .from('rota_weeks')
          .insert({
            department_id: selectedDepartmentId,
            week_start_date: weekStartStr,
            status: 'draft',
          })
          .select()
          .single();

        if (weekError) throw weekError;
        weekId = newWeek.id;
        setRotaWeek(newWeek as RotaWeek);
      }

      // Delete existing assignments for this week
      await supabase
        .from('rota_assignments')
        .delete()
        .eq('rota_week_id', weekId);

      // Insert new assignments
      const newAssignments: Array<{
        rota_week_id: string;
        employee_id: string;
        day_of_week: number;
        shift_code: ShiftCode;
      }> = [];

      assignments.forEach((shift, key) => {
        if (shift) {
          const [employeeId, dayStr] = key.split('-');
          newAssignments.push({
            rota_week_id: weekId!,
            employee_id: employeeId,
            day_of_week: parseInt(dayStr),
            shift_code: shift,
          });
        }
      });

      if (newAssignments.length > 0) {
        const { error: assignError } = await supabase
          .from('rota_assignments')
          .insert(newAssignments);

        if (assignError) throw assignError;
      }

      setOriginalAssignments(new Map(assignments));
      toast.success('Rota saved successfully');
    } catch (error) {
      console.error('Error saving rota:', error);
      toast.error('Failed to save rota');
    } finally {
      setIsSaving(false);
    }
  };

  const publishRota = async () => {
    if (!rotaWeek || !canPublish || !user) return;
    setIsPublishing(true);

    try {
      // Save first if there are changes
      if (hasChanges) {
        await saveRota();
      }

      const { error } = await supabase
        .from('rota_weeks')
        .update({
          status: 'published',
          published_at: new Date().toISOString(),
          published_by: user.id,
        })
        .eq('id', rotaWeek.id);

      if (error) throw error;

      setRotaWeek((prev) =>
        prev
          ? { ...prev, status: 'published', published_at: new Date().toISOString(), published_by: user.id }
          : null
      );
      toast.success('Rota published successfully');
    } catch (error) {
      console.error('Error publishing rota:', error);
      toast.error('Failed to publish rota');
    } finally {
      setIsPublishing(false);
    }
  };

  // No departments to manage
  if (manageableDepartments.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Department Rota</h1>
          <p className="text-muted-foreground">Manage staff schedules</p>
        </div>
        <Card>
          <CardContent className="py-10 text-center">
            <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Department Access</h3>
            <p className="text-muted-foreground">
              You don't have permission to manage any department rotas.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Department Rota</h1>
          <p className="text-muted-foreground">Manage staff schedules</p>
        </div>
        <DepartmentSelector
          departments={manageableDepartments}
          selectedId={selectedDepartmentId}
          onChange={setSelectedDepartmentId}
        />
      </div>

      {selectedDepartment && (
        <>
          <WeekNavigator
            weekStartDate={currentWeekStart}
            department={selectedDepartment}
            status={rotaWeek?.status || 'draft'}
            onNavigate={navigateWeek}
            onGoToToday={goToCurrentWeek}
            onCopyPreviousWeek={copyPreviousWeek}
            onSave={saveRota}
            onPublish={publishRota}
            canPublish={canPublish && !hasChanges}
            isSaving={isSaving}
            isPublishing={isPublishing}
            hasChanges={hasChanges}
            isEditable={isEditable}
          />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <RotaGrid
                employees={employees}
                assignments={assignments}
                weekStartDate={currentWeekStart}
                onShiftChange={handleShiftChange}
                isEditable={isEditable && rotaWeek?.status !== 'published'}
                loading={loading}
                validationIssues={[...blockers, ...warnings]}
                approvedLeaves={approvedLeaves}
              />
            </div>

            <div>
              <ValidationPanel
                blockers={blockers}
                warnings={warnings}
                canPublish={canPublish}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
