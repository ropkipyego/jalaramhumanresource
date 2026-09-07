import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ShiftCell } from './ShiftCell';
import { format, addDays } from 'date-fns';
import type { Profile, ShiftCode, LeaveRequest } from '@/types/database';
import type { ValidationIssue } from '@/hooks/useRotaValidation';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

interface RotaGridProps {
  employees: Profile[];
  assignments: Map<string, ShiftCode | null>;
  weekStartDate: Date;
  onShiftChange: (employeeId: string, dayIndex: number, shift: ShiftCode | null) => void;
  isEditable: boolean;
  loading?: boolean;
  validationIssues: ValidationIssue[];
  approvedLeaves: LeaveRequest[];
}

export function RotaGrid({
  employees,
  assignments,
  weekStartDate,
  onShiftChange,
  isEditable,
  loading = false,
  validationIssues,
  approvedLeaves,
}: RotaGridProps) {
  const getShift = (employeeId: string, dayIndex: number): ShiftCode | null => {
    return assignments.get(`${employeeId}-${dayIndex}`) ?? null;
  };

  const hasIssue = (employeeId: string, dayIndex: number, type: 'blocker' | 'warning'): boolean => {
    return validationIssues.some(
      (issue) =>
        issue.type === type &&
        ((issue.employeeId === employeeId && issue.dayIndex === dayIndex) ||
          (issue.dayIndex === dayIndex && !issue.employeeId))
    );
  };

  const isEmployeeOnLeave = (employeeId: string, dayIndex: number): boolean => {
    const date = addDays(weekStartDate, dayIndex);
    const dateStr = format(date, 'yyyy-MM-dd');
    return approvedLeaves.some((leave) => {
      if (leave.employee_id !== employeeId) return false;
      return dateStr >= leave.start_date && dateStr <= leave.end_date;
    });
  };

  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Weekly Rota</CardTitle>
          <CardDescription>Loading...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (employees.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Weekly Rota</CardTitle>
        </CardHeader>
        <CardContent className="py-10 text-center">
          <p className="text-muted-foreground">No staff assigned to this department.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">Weekly Rota</CardTitle>
            <CardDescription>
              {isEditable ? 'Click on cells to assign shifts' : 'View-only mode'}
            </CardDescription>
          </div>
          <Badge variant="outline" className="text-xs">
            {employees.length} staff
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="text-left p-3 border-b font-medium text-sm text-muted-foreground min-w-[200px] sticky left-0 bg-card z-10">
                  Staff Member
                </th>
                {DAYS.map((day, index) => {
                  const date = addDays(weekStartDate, index);
                  const isToday = format(date, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
                  return (
                    <th
                      key={day}
                      className={`text-center p-3 border-b font-medium text-sm min-w-[120px] ${
                        isToday ? 'bg-accent/50' : ''
                      }`}
                    >
                      <div className="text-muted-foreground text-base">{day}</div>
                      <div className={`text-xs ${isToday ? 'text-primary font-bold' : 'text-muted-foreground'}`}>
                        {format(date, 'd MMM')}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {employees.map((employee) => {
                const leaveDays = DAYS.map((_, i) => isEmployeeOnLeave(employee.id, i)).filter(Boolean).length;
                return (
                  <tr key={employee.id} className="hover:bg-muted/30">
                    <td className="p-3 border-b sticky left-0 bg-card z-10">
                      <div className="flex items-center gap-2">
                        <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium text-sm">
                          {employee.full_name
                            .split(' ')
                            .map((n) => n[0])
                            .join('')
                            .slice(0, 2)
                            .toUpperCase()}
                        </div>
                        <div>
                          <div className="font-medium text-sm">{employee.full_name}</div>
                          <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                            <span>{employee.staff_id}</span>
                            {leaveDays > 0 && (
                              <Badge variant="outline" className="h-4 px-1.5 text-[10px] border-[hsl(var(--warning))] text-[hsl(var(--warning))]">
                                On leave {leaveDays}d
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    {DAYS.map((_, dayIndex) => {
                      const date = addDays(weekStartDate, dayIndex);
                      const isToday = format(date, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
                      const onLeave = isEmployeeOnLeave(employee.id, dayIndex);

                      return (
                        <td
                          key={dayIndex}
                          className={`p-2 border-b min-w-[120px] ${isToday ? 'bg-accent/30' : ''}`}
                        >
                          <ShiftCell
                            value={getShift(employee.id, dayIndex)}
                            onChange={(value) => onShiftChange(employee.id, dayIndex, value)}
                            disabled={!isEditable}
                            hasError={hasIssue(employee.id, dayIndex, 'blocker')}
                            hasWarning={hasIssue(employee.id, dayIndex, 'warning')}
                            isOnLeave={onLeave}
                          />
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
