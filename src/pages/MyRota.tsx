import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { format, startOfWeek, addWeeks, subWeeks, addDays } from 'date-fns';
import type { RotaAssignment, ShiftCode, Department } from '@/types/database';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const getShiftBadgeClass = (shift: ShiftCode) => {
  const classes: Record<ShiftCode, string> = {
    D: 'shift-badge-d',
    N: 'shift-badge-n',
    OFF: 'shift-badge-off',
    PH: 'shift-badge-ph',
  };
  return classes[shift];
};

const getShiftLabel = (shift: ShiftCode) => {
  const labels: Record<ShiftCode, string> = {
    D: 'Day',
    N: 'Night',
    OFF: 'Off',
    PH: 'Public Holiday',
  };
  return labels[shift];
};

export default function MyRota() {
  const { user, departments } = useAuth();
  const [currentWeekStart, setCurrentWeekStart] = useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );
  const [assignments, setAssignments] = useState<RotaAssignment[]>([]);
  const [loading, setLoading] = useState(true);

  const primaryDepartment = departments.find((d) => d.is_primary)?.department;

  useEffect(() => {
    if (user && primaryDepartment) {
      fetchAssignments();
    } else {
      setLoading(false);
    }
  }, [user, primaryDepartment, currentWeekStart]);

  const fetchAssignments = async () => {
    if (!user || !primaryDepartment) return;

    setLoading(true);
    try {
      const weekStartStr = format(currentWeekStart, 'yyyy-MM-dd');

      const { data, error } = await supabase
        .from('rota_weeks')
        .select(`
          id,
          rota_assignments!inner(*)
        `)
        .eq('department_id', primaryDepartment.id)
        .eq('week_start_date', weekStartStr)
        .eq('rota_assignments.employee_id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Error fetching assignments:', error);
      } else if (data) {
        setAssignments(data.rota_assignments as unknown as RotaAssignment[]);
      } else {
        setAssignments([]);
      }
    } finally {
      setLoading(false);
    }
  };

  const getShiftForDay = (dayIndex: number): ShiftCode | null => {
    const assignment = assignments.find((a) => a.day_of_week === dayIndex);
    return assignment?.shift_code ?? null;
  };

  const navigateWeek = (direction: 'prev' | 'next') => {
    setCurrentWeekStart((prev) =>
      direction === 'prev' ? subWeeks(prev, 1) : addWeeks(prev, 1)
    );
  };

  const goToCurrentWeek = () => {
    setCurrentWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }));
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">My Rota</h1>
        <p className="text-muted-foreground">View your scheduled shifts</p>
      </div>

      {!primaryDepartment ? (
        <Card>
          <CardContent className="py-10 text-center">
            <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Department Assigned</h3>
            <p className="text-muted-foreground">
              You haven't been assigned to a department yet. Please contact your administrator.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Week Navigation */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">
                    Week of {format(currentWeekStart, 'MMMM d, yyyy')}
                  </CardTitle>
                  <CardDescription>{primaryDepartment.name}</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={goToCurrentWeek}>
                    Today
                  </Button>
                  <Button variant="outline" size="icon" onClick={() => navigateWeek('prev')}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="icon" onClick={() => navigateWeek('next')}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="grid grid-cols-7 gap-2">
                  {DAYS.map((day) => (
                    <div
                      key={day}
                      className="animate-pulse bg-muted rounded-lg h-24"
                    />
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-7 gap-2">
                  {DAYS.map((day, index) => {
                    const shift = getShiftForDay(index);
                    const date = addDays(currentWeekStart, index);
                    const isToday =
                      format(date, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');

                    return (
                      <div
                        key={day}
                        className={`flex flex-col items-center p-4 rounded-lg border ${
                          isToday ? 'border-primary bg-accent/50' : 'bg-card'
                        }`}
                      >
                        <span className="text-xs text-muted-foreground mb-1">
                          {day}
                        </span>
                        <span className="text-sm font-medium mb-2">
                          {format(date, 'd')}
                        </span>
                        {shift ? (
                          <Badge
                            className={`${getShiftBadgeClass(shift)} px-3 py-1`}
                          >
                            {shift}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Legend */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Shift Legend</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-4">
                {(['D', 'N', 'OFF', 'PH'] as ShiftCode[]).map((shift) => (
                  <div key={shift} className="flex items-center gap-2">
                    <Badge className={`${getShiftBadgeClass(shift)} px-3 py-1`}>
                      {shift}
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      {getShiftLabel(shift)}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}