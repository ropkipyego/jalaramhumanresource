import { useMemo } from 'react';
import type { Profile, RotaAssignment, DepartmentRules, ShiftCode, LeaveRequest } from '@/types/database';
import { addDays, format, parseISO, isWithinInterval } from 'date-fns';

export interface ValidationIssue {
  id: string;
  type: 'blocker' | 'warning';
  message: string;
  dayIndex?: number;
  employeeId?: string;
}

interface UseRotaValidationProps {
  assignments: Map<string, ShiftCode | null>; // key: `${employeeId}-${dayIndex}`
  employees: Profile[];
  rules: DepartmentRules | null;
  weekStartDate: Date;
  approvedLeaves: LeaveRequest[];
  previousWeekAssignments?: Map<string, ShiftCode | null>;
}

export function useRotaValidation({
  assignments,
  employees,
  rules,
  weekStartDate,
  approvedLeaves,
  previousWeekAssignments,
}: UseRotaValidationProps) {
  const issues = useMemo(() => {
    const result: ValidationIssue[] = [];
    
    if (!rules) return result;

    const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    // Helper to get shift for employee on day
    const getShift = (employeeId: string, dayIndex: number): ShiftCode | null => {
      return assignments.get(`${employeeId}-${dayIndex}`) ?? null;
    };

    // Helper to check if employee is on leave for a specific date
    const isOnLeave = (employeeId: string, dayIndex: number): boolean => {
      const date = addDays(weekStartDate, dayIndex);
      const dateStr = format(date, 'yyyy-MM-dd');
      
      return approvedLeaves.some(leave => {
        if (leave.employee_id !== employeeId) return false;
        const start = parseISO(leave.start_date);
        const end = parseISO(leave.end_date);
        return isWithinInterval(date, { start, end });
      });
    };

    // 1. BLOCKER: Staff assigned to shift while on approved leave
    employees.forEach(employee => {
      for (let day = 0; day < 7; day++) {
        const shift = getShift(employee.id, day);
        if (shift && shift !== 'OFF' && isOnLeave(employee.id, day)) {
          result.push({
            id: `leave-conflict-${employee.id}-${day}`,
            type: 'blocker',
            message: `${employee.full_name} is on approved leave on ${DAYS[day]}`,
            dayIndex: day,
            employeeId: employee.id,
          });
        }
      }
    });

    // 2. BLOCKER: Duplicate assignment (same employee assigned twice on same day)
    // This shouldn't happen with our data model but check anyway
    employees.forEach(employee => {
      const assignmentCount = new Map<number, number>();
      for (let day = 0; day < 7; day++) {
        const shift = getShift(employee.id, day);
        if (shift) {
          assignmentCount.set(day, (assignmentCount.get(day) || 0) + 1);
        }
      }
      assignmentCount.forEach((count, day) => {
        if (count > 1) {
          result.push({
            id: `duplicate-${employee.id}-${day}`,
            type: 'blocker',
            message: `${employee.full_name} has duplicate assignments on ${DAYS[day]}`,
            dayIndex: day,
            employeeId: employee.id,
          });
        }
      });
    });

    // 3. BLOCKER: Understaffing - below minimum staff for day/night shifts
    for (let day = 0; day < 7; day++) {
      let dayShiftCount = 0;
      let nightShiftCount = 0;

      employees.forEach(employee => {
        const shift = getShift(employee.id, day);
        if (shift === 'D') dayShiftCount++;
        if (shift === 'N') nightShiftCount++;
      });

      if (dayShiftCount < rules.min_staff_day) {
        result.push({
          id: `understaffed-day-${day}`,
          type: 'blocker',
          message: `${DAYS[day]} day shift understaffed: ${dayShiftCount}/${rules.min_staff_day} required`,
          dayIndex: day,
        });
      }

      if (nightShiftCount < rules.min_staff_night) {
        result.push({
          id: `understaffed-night-${day}`,
          type: 'blocker',
          message: `${DAYS[day]} night shift understaffed: ${nightShiftCount}/${rules.min_staff_night} required`,
          dayIndex: day,
        });
      }
    }

    // 4. WARNING: Consecutive night shifts exceeding maximum
    employees.forEach(employee => {
      let consecutiveNights = 0;
      
      // Check previous week's last days if available
      if (previousWeekAssignments) {
        for (let day = 6; day >= 0; day--) {
          const prevShift = previousWeekAssignments.get(`${employee.id}-${day}`);
          if (prevShift === 'N') {
            consecutiveNights++;
          } else {
            break;
          }
        }
      }

      for (let day = 0; day < 7; day++) {
        const shift = getShift(employee.id, day);
        if (shift === 'N') {
          consecutiveNights++;
          if (consecutiveNights > rules.max_consecutive_nights) {
            result.push({
              id: `consecutive-nights-${employee.id}-${day}`,
              type: 'warning',
              message: `${employee.full_name} has ${consecutiveNights} consecutive nights (max ${rules.max_consecutive_nights})`,
              dayIndex: day,
              employeeId: employee.id,
            });
          }
        } else {
          consecutiveNights = 0;
        }
      }
    });

    // 5. WARNING: Night shift followed immediately by day shift (rest hours)
    employees.forEach(employee => {
      for (let day = 0; day < 6; day++) {
        const currentShift = getShift(employee.id, day);
        const nextShift = getShift(employee.id, day + 1);
        
        if (currentShift === 'N' && nextShift === 'D') {
          result.push({
            id: `rest-hours-${employee.id}-${day}`,
            type: 'warning',
            message: `${employee.full_name} has night shift on ${DAYS[day]} followed by day shift on ${DAYS[day + 1]} (insufficient rest)`,
            dayIndex: day,
            employeeId: employee.id,
          });
        }
      }
    });

    return result;
  }, [assignments, employees, rules, weekStartDate, approvedLeaves, previousWeekAssignments]);

  const blockers = useMemo(() => issues.filter(i => i.type === 'blocker'), [issues]);
  const warnings = useMemo(() => issues.filter(i => i.type === 'warning'), [issues]);
  const canPublish = blockers.length === 0;

  return {
    issues,
    blockers,
    warnings,
    canPublish,
  };
}
