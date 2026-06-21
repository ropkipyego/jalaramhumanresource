import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useRole } from '@/hooks/useRole';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Calendar,
  CalendarDays,
  ClipboardList,
  Users,
  ArrowRight,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Bell,
} from 'lucide-react';
import { PushToggle } from '@/components/notifications/PushToggle';
import { startOfWeek, addDays, format } from 'date-fns';
import type { Database } from '@/integrations/supabase/types';

type ShiftCode = Database['public']['Enums']['shift_code'];

const getShiftBadgeClass = (shift: ShiftCode | null): string => {
  switch (shift) {
    case 'D': return 'shift-badge-d';
    case 'N': return 'shift-badge-n';
    case 'OFF': return 'shift-badge-off';
    case 'PH': return 'shift-badge-ph';
    default: return 'bg-muted';
  }
};

export default function Dashboard() {
  const { user, profile, departments } = useAuth();
  const { role, isHead, isAdmin, isSuperAdmin } = useRole();
  
  const [loading, setLoading] = useState(true);
  const [weekShifts, setWeekShifts] = useState<{ day: number; night: number }>({ day: 0, night: 0 });
  const [pendingLeaveCount, setPendingLeaveCount] = useState(0);
  const [upcomingShifts, setUpcomingShifts] = useState<(ShiftCode | null)[]>(Array(7).fill(null));

  const primaryDepartment = departments?.find(d => d.is_primary)?.department;
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });

  useEffect(() => {
    if (!user || !primaryDepartment) {
      setLoading(false);
      return;
    }

    const fetchDashboardData = async () => {
      try {
        const weekStartStr = format(weekStart, 'yyyy-MM-dd');

        // Fetch rota week and assignments
        const { data: rotaWeek } = await supabase
          .from('rota_weeks')
          .select('id')
          .eq('department_id', primaryDepartment.id)
          .eq('week_start_date', weekStartStr)
          .maybeSingle();

        if (rotaWeek) {
          const { data: assignments } = await supabase
            .from('rota_assignments')
            .select('shift_code, day_of_week')
            .eq('rota_week_id', rotaWeek.id)
            .eq('employee_id', user.id);

          if (assignments) {
            const dayCount = assignments.filter(a => a.shift_code === 'D').length;
            const nightCount = assignments.filter(a => a.shift_code === 'N').length;
            setWeekShifts({ day: dayCount, night: nightCount });

            const shifts: (ShiftCode | null)[] = Array(7).fill(null);
            assignments.forEach(a => {
              shifts[a.day_of_week] = a.shift_code;
            });
            setUpcomingShifts(shifts);
          }
        }

        // Fetch pending leave requests count
        const { count } = await supabase
          .from('leave_requests')
          .select('*', { count: 'exact', head: true })
          .eq('employee_id', user.id)
          .eq('status', 'pending');

        setPendingLeaveCount(count || 0);
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [user, primaryDepartment]);

  const quickActions = [
    {
      title: 'View My Rota',
      description: 'Check your upcoming shifts',
      icon: Calendar,
      link: '/my-rota',
      color: 'bg-info/10 text-info',
    },
    {
      title: 'Request Leave',
      description: 'Submit a new leave request',
      icon: CalendarDays,
      link: '/my-leave',
      color: 'bg-success/10 text-success',
    },
  ];

  if (isHead || isAdmin || isSuperAdmin) {
    quickActions.push({
      title: 'Manage Rota',
      description: 'Edit department schedules',
      icon: ClipboardList,
      link: '/rota',
      color: 'bg-warning/10 text-warning',
    });
  }

  if (isAdmin || isSuperAdmin) {
    quickActions.push({
      title: 'Leave Requests',
      description: 'Review pending requests',
      icon: CheckCircle2,
      link: '/leave-requests',
      color: 'bg-primary/10 text-primary',
    });
  }

  const totalShifts = weekShifts.day + weekShifts.night;
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Welcome back, {profile?.full_name?.split(' ')[0] || 'User'}!
          </h1>
          <p className="text-muted-foreground">
            Here's what's happening with your schedule today.
          </p>
        </div>
        <Badge variant="outline" className="w-fit capitalize">
          {role?.toLowerCase().replace('_', ' ') || 'Staff'}
        </Badge>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              This Week
            </CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <>
                <div className="text-2xl font-bold">{totalShifts} Shift{totalShifts !== 1 ? 's' : ''}</div>
                <p className="text-xs text-muted-foreground">
                  {weekShifts.day} Day, {weekShifts.night} Night
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Department
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-32" />
            ) : (
              <>
                <div className="text-2xl font-bold">{primaryDepartment?.name || 'None'}</div>
                <p className="text-xs text-muted-foreground">Primary department</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Pending Requests
            </CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <>
                <div className="text-2xl font-bold">{pendingLeaveCount}</div>
                <p className="text-xs text-muted-foreground">Leave requests pending</p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {quickActions.map((action) => (
            <Card key={action.link} className="group hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${action.color}`}>
                  <action.icon className="h-5 w-5" />
                </div>
              </CardHeader>
              <CardContent className="pb-4">
                <CardTitle className="text-base mb-1">{action.title}</CardTitle>
                <CardDescription className="text-sm">{action.description}</CardDescription>
              </CardContent>
              <div className="px-6 pb-4">
                <Button asChild variant="ghost" size="sm" className="p-0 h-auto">
                  <Link to={action.link} className="flex items-center gap-1 text-primary">
                    Go to page
                    <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-1" />
                  </Link>
                </Button>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* Upcoming Shifts Preview */}
      <Card>
        <CardHeader>
          <CardTitle>Upcoming Shifts</CardTitle>
          <CardDescription>
            Week of {format(weekStart, 'MMM d')} - {format(addDays(weekStart, 6), 'MMM d, yyyy')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-2">
            {days.map((day, index) => (
              <div
                key={day}
                className="flex flex-col items-center p-3 rounded-lg bg-muted/50"
              >
                <span className="text-xs text-muted-foreground mb-1">{day}</span>
                {loading ? (
                  <Skeleton className="h-5 w-8" />
                ) : (
                  <span className={`text-sm font-medium px-2 py-0.5 rounded ${getShiftBadgeClass(upcomingShifts[index])}`}>
                    {upcomingShifts[index] || '—'}
                  </span>
                )}
              </div>
            ))}
          </div>
          <div className="mt-4 flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded shift-badge-d"></div>
              <span>Day Shift</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded shift-badge-n"></div>
              <span>Night Shift</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded shift-badge-off"></div>
              <span>Off</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded shift-badge-ph"></div>
              <span>Public Holiday</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Bell className="h-5 w-5" />Notifications</CardTitle>
          <CardDescription>
            Get a pop-up on this device when your leave is approved or rejected, and when a new rota is published.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PushToggle />
        </CardContent>
      </Card>
    </div>
  );
}