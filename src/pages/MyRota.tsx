import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar, 
  Clock, 
  Moon, 
  Sun, 
  Palmtree, 
  PartyPopper,
  CalendarDays
} from 'lucide-react';
import { format, startOfWeek, addWeeks, subWeeks, addDays, isSameDay } from 'date-fns';
import type { RotaAssignment, ShiftCode, RotaWeek } from '@/types/database';

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

const getShiftDetails = (shift: ShiftCode) => {
  const details: Record<ShiftCode, { label: string; time: string; icon: React.ElementType }> = {
    D: { label: 'Day Shift', time: '07:00 - 19:00', icon: Sun },
    N: { label: 'Night Shift', time: '19:00 - 07:00', icon: Moon },
    OFF: { label: 'Day Off', time: 'Rest Day', icon: Palmtree },
    PH: { label: 'Public Holiday', time: 'Holiday', icon: PartyPopper },
  };
  return details[shift];
};

export default function MyRota() {
  const { user, departments } = useAuth();
  const [currentWeekStart, setCurrentWeekStart] = useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );
  const [assignments, setAssignments] = useState<RotaAssignment[]>([]);
  const [rotaWeek, setRotaWeek] = useState<RotaWeek | null>(null);
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
          *,
          rota_assignments!inner(*)
        `)
        .eq('department_id', primaryDepartment.id)
        .eq('week_start_date', weekStartStr)
        .eq('rota_assignments.employee_id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Error fetching assignments:', error);
        setAssignments([]);
        setRotaWeek(null);
      } else if (data) {
        setRotaWeek(data as unknown as RotaWeek);
        setAssignments(data.rota_assignments as unknown as RotaAssignment[]);
      } else {
        setAssignments([]);
        setRotaWeek(null);
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

  // Calculate weekly stats
  const weekStats = {
    dayShifts: assignments.filter((a) => a.shift_code === 'D').length,
    nightShifts: assignments.filter((a) => a.shift_code === 'N').length,
    daysOff: assignments.filter((a) => a.shift_code === 'OFF').length,
    publicHolidays: assignments.filter((a) => a.shift_code === 'PH').length,
  };

  const totalHours = (weekStats.dayShifts + weekStats.nightShifts) * 12;
  const isCurrentWeek = isSameDay(currentWeekStart, startOfWeek(new Date(), { weekStartsOn: 1 }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">My Rota</h1>
          <p className="text-muted-foreground">View your scheduled shifts</p>
        </div>
        {primaryDepartment && (
          <Badge variant="outline" className="w-fit">
            {primaryDepartment.name}
          </Badge>
        )}
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
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <CalendarDays className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">
                      {format(currentWeekStart, 'MMMM d')} - {format(addDays(currentWeekStart, 6), 'd, yyyy')}
                    </CardTitle>
                    <CardDescription className="flex items-center gap-2">
                      {rotaWeek?.status === 'published' ? (
                        <Badge variant="default" className="text-xs bg-success">Published</Badge>
                      ) : rotaWeek ? (
                        <Badge variant="secondary" className="text-xs">Draft</Badge>
                      ) : (
                        <span className="text-xs">No rota available</span>
                      )}
                    </CardDescription>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button 
                    variant={isCurrentWeek ? "default" : "outline"} 
                    size="sm" 
                    onClick={goToCurrentWeek}
                  >
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
          </Card>

          {/* Weekly Stats */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <Card>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-[hsl(var(--shift-day))]/10 flex items-center justify-center">
                    <Sun className="h-4 w-4 text-[hsl(var(--shift-day))]" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold">{weekStats.dayShifts}</div>
                    <div className="text-xs text-muted-foreground">Day Shifts</div>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-[hsl(var(--shift-night))]/10 flex items-center justify-center">
                    <Moon className="h-4 w-4 text-[hsl(var(--shift-night))]" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold">{weekStats.nightShifts}</div>
                    <div className="text-xs text-muted-foreground">Night Shifts</div>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-[hsl(var(--shift-off))]/20 flex items-center justify-center">
                    <Palmtree className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold">{weekStats.daysOff}</div>
                    <div className="text-xs text-muted-foreground">Days Off</div>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-[hsl(var(--shift-ph))]/10 flex items-center justify-center">
                    <PartyPopper className="h-4 w-4 text-[hsl(var(--shift-ph))]" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold">{weekStats.publicHolidays}</div>
                    <div className="text-xs text-muted-foreground">Holidays</div>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="col-span-2 md:col-span-1">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Clock className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold">{totalHours}h</div>
                    <div className="text-xs text-muted-foreground">Total Hours</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Weekly Rota Grid */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Weekly Schedule</CardTitle>
              <CardDescription>Your shift assignments for the week</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="grid grid-cols-7 gap-3">
                  {DAYS.map((day) => (
                    <Skeleton key={day} className="h-32 w-full rounded-lg" />
                  ))}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <div className="grid grid-cols-7 gap-3 min-w-[700px]">
                    {DAYS.map((day, index) => {
                      const shift = getShiftForDay(index);
                      const date = addDays(currentWeekStart, index);
                      const isToday = isSameDay(date, new Date());
                      const shiftDetails = shift ? getShiftDetails(shift) : null;
                      const ShiftIcon = shiftDetails?.icon;

                      return (
                        <div
                          key={day}
                          className={`flex flex-col rounded-lg border transition-all ${
                            isToday 
                              ? 'border-primary ring-2 ring-primary/20 shadow-md' 
                              : 'border-border hover:border-primary/30'
                          }`}
                        >
                          {/* Header */}
                          <div className={`px-3 py-2 border-b ${isToday ? 'bg-primary/5' : 'bg-muted/30'}`}>
                            <div className="text-xs text-muted-foreground font-medium">{day}</div>
                            <div className={`text-lg font-bold ${isToday ? 'text-primary' : ''}`}>
                              {format(date, 'd')}
                            </div>
                          </div>
                          
                          {/* Shift Details */}
                          <div className="flex-1 p-3 flex flex-col items-center justify-center min-h-[80px]">
                            {shift ? (
                              <>
                                <div className={`h-10 w-10 rounded-full flex items-center justify-center mb-2 ${getShiftBadgeClass(shift)}`}>
                                  {ShiftIcon && <ShiftIcon className="h-5 w-5" />}
                                </div>
                                <Badge className={`${getShiftBadgeClass(shift)} px-3 py-1 mb-1`}>
                                  {shift}
                                </Badge>
                                <span className="text-[10px] text-muted-foreground text-center">
                                  {shiftDetails?.time}
                                </span>
                              </>
                            ) : (
                              <div className="text-center">
                                <div className="h-10 w-10 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-2">
                                  <Calendar className="h-4 w-4 text-muted-foreground/50" />
                                </div>
                                <span className="text-xs text-muted-foreground">No shift</span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
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
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {(['D', 'N', 'OFF', 'PH'] as ShiftCode[]).map((shift) => {
                  const details = getShiftDetails(shift);
                  const ShiftIcon = details.icon;
                  return (
                    <div key={shift} className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                      <div className={`h-8 w-8 rounded-full flex items-center justify-center ${getShiftBadgeClass(shift)}`}>
                        <ShiftIcon className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="text-sm font-medium">{details.label}</div>
                        <div className="text-xs text-muted-foreground">{details.time}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}