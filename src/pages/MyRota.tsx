import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRole } from '@/hooks/useRole';
import { useManageableDepartments } from '@/hooks/useManageableDepartments';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  ChevronLeft, ChevronRight, Calendar, Clock, Moon, Sun, Palmtree, PartyPopper, CalendarDays, Users, Search,
} from 'lucide-react';
import {
  format, startOfWeek, addWeeks, subWeeks, addDays, isSameDay,
  startOfMonth, endOfMonth, addMonths, subMonths, eachDayOfInterval, getDay,
} from 'date-fns';
import type { ShiftCode } from '@/types/database';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const getShiftBadgeClass = (shift: ShiftCode | null) => {
  if (!shift) return 'bg-muted';
  const classes: Record<ShiftCode, string> = {
    D: 'shift-badge-d', N: 'shift-badge-n', OFF: 'shift-badge-off', PH: 'shift-badge-ph',
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

type ViewMode = 'week-mine' | 'week-all' | 'month-mine' | 'month-all';

interface ShiftCell {
  date: string;
  employee_id: string;
  shift_code: ShiftCode;
}

export default function MyRota() {
  const { user, departments } = useAuth();
  const [viewMode, setViewMode] = useState<ViewMode>('week-mine');
  const [currentWeekStart, setCurrentWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [currentMonth, setCurrentMonth] = useState(() => startOfMonth(new Date()));
  const [shifts, setShifts] = useState<ShiftCell[]>([]);
  const [people, setPeople] = useState<Array<{ id: string; full_name: string; staff_id: string }>>([]);
  const [loading, setLoading] = useState(true);

  const primaryDepartment = departments.find((d) => d.is_primary)?.department;
  const isMonth = viewMode.startsWith('month');
  const isAll = viewMode.endsWith('all');

  useEffect(() => {
    if (user && primaryDepartment) fetchData();
    else setLoading(false);
  }, [user, primaryDepartment, currentWeekStart, currentMonth, viewMode]);

  const fetchData = async () => {
    if (!user || !primaryDepartment) return;
    setLoading(true);
    try {
      const rangeStart = isMonth ? startOfMonth(currentMonth) : currentWeekStart;
      const rangeEnd = isMonth ? endOfMonth(currentMonth) : addDays(currentWeekStart, 6);

      const { data: weeks } = await supabase
        .from('rota_weeks')
        .select('id, week_start_date')
        .eq('department_id', primaryDepartment.id)
        .gte('week_start_date', format(addDays(rangeStart, -7), 'yyyy-MM-dd'))
        .lte('week_start_date', format(rangeEnd, 'yyyy-MM-dd'));

      const weekIds = (weeks || []).map((w) => w.id);
      if (weekIds.length === 0) {
        setShifts([]); setPeople([]); setLoading(false); return;
      }

      let assignmentsQuery = supabase
        .from('rota_assignments')
        .select('employee_id, day_of_week, shift_code, rota_week_id')
        .in('rota_week_id', weekIds);

      if (!isAll) assignmentsQuery = assignmentsQuery.eq('employee_id', user.id);

      const { data: assignments } = await assignmentsQuery;
      const weekMap = new Map((weeks || []).map((w) => [w.id, w.week_start_date]));

      const cells: ShiftCell[] = (assignments || []).map((a: any) => {
        const ws = weekMap.get(a.rota_week_id);
        const date = ws ? format(addDays(new Date(ws + 'T00:00:00'), a.day_of_week), 'yyyy-MM-dd') : '';
        return { date, employee_id: a.employee_id, shift_code: a.shift_code as ShiftCode };
      }).filter((c) => {
        const d = new Date(c.date + 'T00:00:00');
        return d >= rangeStart && d <= rangeEnd;
      });

      setShifts(cells);

      if (isAll) {
        const empIds = Array.from(new Set(cells.map((c) => c.employee_id)));
        const { data: deptEmps } = await supabase
          .from('employee_departments')
          .select('employee_id, profiles:employee_id(id, full_name, staff_id)')
          .eq('department_id', primaryDepartment.id);
        const list = (deptEmps || [])
          .map((d: any) => d.profiles)
          .filter(Boolean)
          .filter((p: any) => empIds.length === 0 || empIds.includes(p.id));
        setPeople(list);
      } else {
        setPeople([]);
      }
    } finally {
      setLoading(false);
    }
  };

  const navigate = (direction: 'prev' | 'next') => {
    if (isMonth) {
      setCurrentMonth((p) => (direction === 'prev' ? subMonths(p, 1) : addMonths(p, 1)));
    } else {
      setCurrentWeekStart((p) => (direction === 'prev' ? subWeeks(p, 1) : addWeeks(p, 1)));
    }
  };

  const goToToday = () => {
    setCurrentWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }));
    setCurrentMonth(startOfMonth(new Date()));
  };

  const myShiftForDate = (dateStr: string): ShiftCode | null => {
    const c = shifts.find((s) => s.employee_id === user?.id && s.date === dateStr);
    return c?.shift_code ?? null;
  };

  const shiftFor = (employeeId: string, dateStr: string): ShiftCode | null => {
    const c = shifts.find((s) => s.employee_id === employeeId && s.date === dateStr);
    return c?.shift_code ?? null;
  };

  const headerLabel = isMonth
    ? format(currentMonth, 'MMMM yyyy')
    : `${format(currentWeekStart, 'MMM d')} - ${format(addDays(currentWeekStart, 6), 'd, yyyy')}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">My Rota</h1>
          <p className="text-muted-foreground">View your shifts or your whole department</p>
        </div>
        {primaryDepartment && <Badge variant="outline" className="w-fit">{primaryDepartment.name}</Badge>}
      </div>

      {!primaryDepartment ? (
        <Card>
          <CardContent className="py-10 text-center">
            <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Department Assigned</h3>
            <p className="text-muted-foreground">Contact your administrator.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <CalendarDays className="h-5 w-5 text-primary" />
                  </div>
                  <CardTitle className="text-lg">{headerLabel}</CardTitle>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)}>
                    <TabsList>
                      <TabsTrigger value="week-mine">Week · Me</TabsTrigger>
                      <TabsTrigger value="week-all"><Users className="h-3 w-3 mr-1" />Week · All</TabsTrigger>
                      <TabsTrigger value="month-mine">Month · Me</TabsTrigger>
                      <TabsTrigger value="month-all"><Users className="h-3 w-3 mr-1" />Month · All</TabsTrigger>
                    </TabsList>
                  </Tabs>
                  <Button variant="outline" size="sm" onClick={goToToday}>Today</Button>
                  <Button variant="outline" size="icon" onClick={() => navigate('prev')}><ChevronLeft className="h-4 w-4" /></Button>
                  <Button variant="outline" size="icon" onClick={() => navigate('next')}><ChevronRight className="h-4 w-4" /></Button>
                </div>
              </div>
            </CardHeader>
          </Card>

          {loading ? (
            <Skeleton className="h-64 w-full" />
          ) : viewMode === 'week-mine' ? (
            <WeekMineView weekStart={currentWeekStart} myShiftForDate={myShiftForDate} />
          ) : viewMode === 'week-all' ? (
            <DeptTableView dates={Array.from({ length: 7 }, (_, i) => addDays(currentWeekStart, i))}
              people={people} shiftFor={shiftFor} />
          ) : viewMode === 'month-mine' ? (
            <MonthMineView month={currentMonth} myShiftForDate={myShiftForDate} />
          ) : (
            <DeptTableView dates={eachDayOfInterval({ start: startOfMonth(currentMonth), end: endOfMonth(currentMonth) })}
              people={people} shiftFor={shiftFor} compact />
          )}

          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Shift Legend</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {(['D', 'N', 'OFF', 'PH'] as ShiftCode[]).map((shift) => {
                  const d = getShiftDetails(shift);
                  const I = d.icon;
                  return (
                    <div key={shift} className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                      <div className={`h-8 w-8 rounded-full flex items-center justify-center ${getShiftBadgeClass(shift)}`}>
                        <I className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="text-sm font-medium">{d.label}</div>
                        <div className="text-xs text-muted-foreground">{d.time}</div>
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

function WeekMineView({ weekStart, myShiftForDate }: { weekStart: Date; myShiftForDate: (d: string) => ShiftCode | null }) {
  return (
    <Card>
      <CardHeader className="pb-3"><CardTitle className="text-base">Weekly Schedule</CardTitle></CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <div className="grid grid-cols-7 gap-3 min-w-[700px]">
            {DAYS.map((day, index) => {
              const date = addDays(weekStart, index);
              const dateStr = format(date, 'yyyy-MM-dd');
              const shift = myShiftForDate(dateStr);
              const isToday = isSameDay(date, new Date());
              const details = shift ? getShiftDetails(shift) : null;
              const Icon = details?.icon;
              return (
                <div key={day} className={`flex flex-col rounded-lg border ${isToday ? 'border-primary ring-2 ring-primary/20' : 'border-border'}`}>
                  <div className={`px-3 py-2 border-b ${isToday ? 'bg-primary/5' : 'bg-muted/30'}`}>
                    <div className="text-xs text-muted-foreground font-medium">{day}</div>
                    <div className={`text-lg font-bold ${isToday ? 'text-primary' : ''}`}>{format(date, 'd')}</div>
                  </div>
                  <div className="flex-1 p-3 flex flex-col items-center justify-center min-h-[80px]">
                    {shift ? (
                      <>
                        <div className={`h-10 w-10 rounded-full flex items-center justify-center mb-2 ${getShiftBadgeClass(shift)}`}>
                          {Icon && <Icon className="h-5 w-5" />}
                        </div>
                        <Badge className={`${getShiftBadgeClass(shift)} px-3 py-1`}>{shift}</Badge>
                      </>
                    ) : (
                      <span className="text-xs text-muted-foreground">No shift</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function MonthMineView({ month, myShiftForDate }: { month: Date; myShiftForDate: (d: string) => ShiftCode | null }) {
  const start = startOfMonth(month);
  const end = endOfMonth(month);
  const days = eachDayOfInterval({ start, end });
  const firstDayOfWeek = (getDay(start) + 6) % 7; // Mon=0
  const blanks = Array.from({ length: firstDayOfWeek });

  return (
    <Card>
      <CardHeader className="pb-3"><CardTitle className="text-base">Monthly Schedule</CardTitle></CardHeader>
      <CardContent>
        <div className="grid grid-cols-7 gap-1 mb-2">
          {DAYS.map((d) => <div key={d} className="text-xs text-muted-foreground font-medium text-center">{d}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {blanks.map((_, i) => <div key={`b-${i}`} />)}
          {days.map((date) => {
            const dateStr = format(date, 'yyyy-MM-dd');
            const shift = myShiftForDate(dateStr);
            const isToday = isSameDay(date, new Date());
            return (
              <div key={dateStr} className={`rounded-lg border p-2 min-h-[64px] flex flex-col ${isToday ? 'border-primary ring-1 ring-primary/30' : 'border-border'}`}>
                <div className={`text-xs font-semibold ${isToday ? 'text-primary' : ''}`}>{format(date, 'd')}</div>
                {shift ? (
                  <Badge className={`${getShiftBadgeClass(shift)} mt-auto self-start text-[10px] px-1.5 py-0`}>{shift}</Badge>
                ) : <span className="text-[10px] text-muted-foreground/50 mt-auto">—</span>}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function DeptTableView({
  dates, people, shiftFor, compact = false,
}: {
  dates: Date[];
  people: Array<{ id: string; full_name: string; staff_id: string }>;
  shiftFor: (employeeId: string, dateStr: string) => ShiftCode | null;
  compact?: boolean;
}) {
  if (people.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center">
          <Users className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">No published rota for this period.</p>
        </CardContent>
      </Card>
    );
  }
  const cellW = compact ? 'min-w-[40px]' : 'min-w-[60px]';
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Department Rota — Everyone</CardTitle>
        <CardDescription>{people.length} staff · {dates.length} days</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="border-collapse">
            <thead>
              <tr>
                <th className="text-left p-2 border-b sticky left-0 bg-card z-10 min-w-[180px]">Staff</th>
                {dates.map((d) => {
                  const isToday = isSameDay(d, new Date());
                  return (
                    <th key={d.toISOString()} className={`p-1 border-b text-center ${cellW} ${isToday ? 'bg-accent/50' : ''}`}>
                      <div className="text-[10px] text-muted-foreground">{format(d, 'EEE')}</div>
                      <div className={`text-xs ${isToday ? 'text-primary font-bold' : ''}`}>{format(d, 'd')}</div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {people.map((p) => (
                <tr key={p.id} className="hover:bg-muted/30">
                  <td className="p-2 border-b sticky left-0 bg-card z-10">
                    <div className="font-medium text-sm">{p.full_name}</div>
                    <div className="text-xs text-muted-foreground">{p.staff_id}</div>
                  </td>
                  {dates.map((d) => {
                    const dateStr = format(d, 'yyyy-MM-dd');
                    const shift = shiftFor(p.id, dateStr);
                    return (
                      <td key={dateStr} className="p-1 border-b text-center">
                        {shift ? (
                          <Badge className={`${getShiftBadgeClass(shift)} text-[10px] px-1.5 py-0`}>{shift}</Badge>
                        ) : <span className="text-muted-foreground/40 text-xs">·</span>}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
