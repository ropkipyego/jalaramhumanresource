import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRole } from '@/hooks/useRole';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Calendar } from 'lucide-react';
import { format, startOfWeek, addWeeks, subWeeks, startOfMonth, endOfMonth, addMonths, subMonths, eachDayOfInterval, addDays } from 'date-fns';
import { toast } from 'sonner';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

import { WeekNavigator } from '@/components/rota/WeekNavigator';
import { DepartmentSelector } from '@/components/rota/DepartmentSelector';
import { RotaGrid } from '@/components/rota/RotaGrid';
import { ValidationPanel } from '@/components/rota/ValidationPanel';
import { useRotaValidation } from '@/hooks/useRotaValidation';
import { useManageableDepartments } from '@/hooks/useManageableDepartments';
import {
  departmentUsesTimedShifts,
  defaultTemplateIdForShift,
  filterReceptionTemplates,
  type TimedTemplateOption,
} from '@/lib/receptionShifts';
import { matchShiftTemplate, type ShiftTemplateRow } from '@/lib/shiftCodeParse';

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
  const [viewMode, setViewMode] = useState<'week' | 'month'>('week');
  const [currentWeekStart, setCurrentWeekStart] = useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );
  const [currentMonth, setCurrentMonth] = useState(() => startOfMonth(new Date()));
  const [monthCells, setMonthCells] = useState<Array<{ employee_id: string; date: string; shift_code: ShiftCode | null }>>([]);

  // Data state
  const [rotaWeek, setRotaWeek] = useState<RotaWeek | null>(null);
  const [employees, setEmployees] = useState<Profile[]>([]);
  const [assignments, setAssignments] = useState<Map<string, ShiftCode | null>>(new Map());
  const [templateIds, setTemplateIds] = useState<Map<string, string | null>>(new Map());
  const [timedTemplates, setTimedTemplates] = useState<TimedTemplateOption[]>([]);
  const [allTemplates, setAllTemplates] = useState<ShiftTemplateRow[]>([]);
  const [originalAssignments, setOriginalAssignments] = useState<Map<string, ShiftCode | null>>(new Map());
  const [originalTemplateIds, setOriginalTemplateIds] = useState<Map<string, string | null>>(new Map());
  const [departmentRules, setDepartmentRules] = useState<DepartmentRules | null>(null);
  const [approvedLeaves, setApprovedLeaves] = useState<LeaveRequest[]>([]);
  const [previousWeekAssignments, setPreviousWeekAssignments] = useState<Map<string, ShiftCode | null>>(new Map());

  // Loading state
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);

  const selectedDepartment = manageableDepartments.find((d) => d.id === selectedDepartmentId);
  const useTimedShifts = departmentUsesTimedShifts(selectedDepartment?.name);
  const isEditable = selectedDepartment ? hasRole('HEAD') || hasRole('ADMIN') : false;
  const hasChanges = useMemo(() => {
    if (assignments.size !== originalAssignments.size) return true;
    for (const [key, value] of assignments) {
      if (originalAssignments.get(key) !== value) return true;
    }
    if (templateIds.size !== originalTemplateIds.size) return true;
    for (const [key, value] of templateIds) {
      if (originalTemplateIds.get(key) !== value) return true;
    }
    for (const [key, value] of originalTemplateIds) {
      if (templateIds.get(key) !== value) return true;
    }
    return false;
  }, [assignments, originalAssignments, templateIds, originalTemplateIds]);

  // Validation
  const { blockers, warnings, canPublish } = useRotaValidation({
    assignments,
    employees,
    rules: departmentRules,
    weekStartDate: currentWeekStart,
    approvedLeaves,
    previousWeekAssignments,
  });

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('shift_templates')
        .select('id, code, name, start_time, end_time, department_id, is_active, is_night')
        .eq('is_active', true);
      const rows = (data || []) as ShiftTemplateRow[];
      setAllTemplates(rows);
      setTimedTemplates(filterReceptionTemplates(rows as any));
    })();
  }, []);

  // Set initial department
  useEffect(() => {
    if (manageableDepartments.length > 0 && !selectedDepartmentId) {
      setSelectedDepartmentId(manageableDepartments[0].id);
    }
  }, [manageableDepartments, selectedDepartmentId]);

  // Fetch data when department or week changes
  useEffect(() => {
    if (selectedDepartmentId) {
      if (viewMode === 'week') fetchData();
      else fetchMonthView();
    }
  }, [selectedDepartmentId, currentWeekStart, currentMonth, viewMode]);

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
        const tmplMap = new Map<string, string | null>();
        week.rota_assignments?.forEach((a) => {
          const key = `${a.employee_id}-${a.day_of_week}`;
          assignMap.set(key, a.shift_code);
          if (a.shift_template_id) tmplMap.set(key, a.shift_template_id);
        });
        setAssignments(assignMap);
        setTemplateIds(tmplMap);
        setOriginalAssignments(new Map(assignMap));
        setOriginalTemplateIds(new Map(tmplMap));
      } else {
        setRotaWeek(null);
        setAssignments(new Map());
        setTemplateIds(new Map());
        setOriginalAssignments(new Map());
        setOriginalTemplateIds(new Map());
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

  const fetchMonthView = async () => {
    if (!selectedDepartmentId) return;
    setLoading(true);
    try {
      const monthStart = startOfMonth(currentMonth);
      const monthEnd = endOfMonth(currentMonth);
      const [employeesRes, weeksRes] = await Promise.all([
        supabase
          .from('employee_departments')
          .select('employee:profiles(*)')
          .eq('department_id', selectedDepartmentId),
        supabase
          .from('rota_weeks')
          .select('week_start_date, rota_assignments(employee_id, day_of_week, shift_code)')
          .eq('department_id', selectedDepartmentId)
          .gte('week_start_date', format(monthStart, 'yyyy-MM-dd'))
          .lte('week_start_date', format(monthEnd, 'yyyy-MM-dd')),
      ]);

      if (employeesRes.data) {
        const empList = employeesRes.data
          .map((e) => (e.employee as unknown as Profile))
          .filter((e): e is Profile => e !== null && e.is_active);
        setEmployees(empList);
      }

      const cells: Array<{ employee_id: string; date: string; shift_code: ShiftCode | null }> = [];
      (weeksRes.data as any[])?.forEach((w) => {
        const ws = new Date(`${w.week_start_date}T00:00:00`);
        w.rota_assignments?.forEach((a: RotaAssignment) => {
          const d = addDays(ws, a.day_of_week);
          cells.push({
            employee_id: a.employee_id,
            date: format(d, 'yyyy-MM-dd'),
            shift_code: a.shift_code,
          });
        });
      });
      setMonthCells(cells);
      setRotaWeek(null);
    } catch (e) {
      console.error(e);
      toast.error('Failed to load monthly rota');
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
    if (useTimedShifts && shift && (shift === 'D' || shift === 'N')) {
      const tid = defaultTemplateIdForShift(timedTemplates, shift);
      setTemplateIds((prev) => {
        const next = new Map(prev);
        next.set(`${employeeId}-${dayIndex}`, tid);
        return next;
      });
    } else if (shift === null || shift === 'OFF' || shift === 'PH') {
      setTemplateIds((prev) => {
        const next = new Map(prev);
        next.delete(`${employeeId}-${dayIndex}`);
        return next;
      });
    }
  }, [useTimedShifts, timedTemplates]);

  const handleTemplateChange = useCallback((employeeId: string, dayIndex: number, templateId: string | null) => {
    setTemplateIds((prev) => {
      const next = new Map(prev);
      const key = `${employeeId}-${dayIndex}`;
      if (templateId) next.set(key, templateId);
      else next.delete(key);
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
        shift_template_id?: string | null;
      }> = [];

      assignments.forEach((shift, key) => {
        if (shift) {
          const [employeeId, dayStr] = key.split('-');
          let shift_template_id = templateIds.get(key) ?? null;
          if (!shift_template_id && useTimedShifts && (shift === 'D' || shift === 'N')) {
            shift_template_id = defaultTemplateIdForShift(timedTemplates, shift);
          }
          if (!shift_template_id && allTemplates.length) {
            const start =
              shift === 'N' ? '18:30' : shift === 'D' ? '08:00' : null;
            shift_template_id = matchShiftTemplate(allTemplates, selectedDepartmentId, start, shift);
          }
          newAssignments.push({
            rota_week_id: weekId!,
            employee_id: employeeId,
            day_of_week: parseInt(dayStr),
            shift_code: shift,
            shift_template_id,
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
      setOriginalTemplateIds(new Map(templateIds));
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
          {useTimedShifts && (
            <p className="text-xs text-primary mt-1 max-w-xl">
              Reception / housekeeping: choose Day or Night, then the slot (6:30–14:30, 8–4, 10:30–6:30, or night 18:30–06:30). Used for lateness &amp; overtime.
            </p>
          )}
        </div>
        <DepartmentSelector
          departments={manageableDepartments}
          selectedId={selectedDepartmentId}
          onChange={setSelectedDepartmentId}
        />
      </div>

      {selectedDepartment && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'week' | 'month')}>
              <TabsList>
                <TabsTrigger value="week">Week (edit)</TabsTrigger>
                <TabsTrigger value="month">Month (view)</TabsTrigger>
              </TabsList>
            </Tabs>
            {viewMode === 'month' && (
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setCurrentMonth(startOfMonth(new Date()))}>This month</Button>
                <Button variant="outline" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>‹</Button>
                <span className="text-sm font-medium min-w-[140px] text-center">{format(currentMonth, 'MMMM yyyy')}</span>
                <Button variant="outline" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>›</Button>
              </div>
            )}
          </div>

          {viewMode === 'week' ? (
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
                timedTemplates={useTimedShifts ? timedTemplates : undefined}
                templateIds={templateIds}
                onTemplateChange={useTimedShifts ? handleTemplateChange : undefined}
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
          ) : (
          <Card>
            <CardContent className="pt-6 overflow-x-auto">
              {loading ? (
                <p className="text-muted-foreground text-center py-8">Loading month…</p>
              ) : (
                <table className="w-full text-xs border-collapse min-w-[800px]">
                  <thead>
                    <tr>
                      <th className="text-left p-2 border-b sticky left-0 bg-background">Staff</th>
                      {eachDayOfInterval({ start: startOfMonth(currentMonth), end: endOfMonth(currentMonth) }).map((d) => (
                        <th key={d.toISOString()} className="p-1 border-b font-normal text-muted-foreground">{format(d, 'd')}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {employees.map((emp) => (
                      <tr key={emp.id}>
                        <td className="p-2 border-b sticky left-0 bg-background whitespace-nowrap">{emp.full_name}</td>
                        {eachDayOfInterval({ start: startOfMonth(currentMonth), end: endOfMonth(currentMonth) }).map((d) => {
                          const ds = format(d, 'yyyy-MM-dd');
                          const cell = monthCells.find((c) => c.employee_id === emp.id && c.date === ds);
                          return (
                            <td key={ds} className="p-1 border-b text-center">{cell?.shift_code || '—'}</td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <p className="text-xs text-muted-foreground mt-3">Monthly view is read-only. Switch to Week to edit and publish.</p>
            </CardContent>
          </Card>
          )}
        </>
      )}
    </div>
  );
}
