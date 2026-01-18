import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useRole } from '@/hooks/useRole';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Calendar,
  CalendarDays,
  ClipboardList,
  Users,
  ArrowRight,
  Clock,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';

export default function Dashboard() {
  const { profile } = useAuth();
  const { role, isHead, isAdmin, isSuperAdmin } = useRole();

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
            <div className="text-2xl font-bold">5 Shifts</div>
            <p className="text-xs text-muted-foreground">3 Day, 2 Night</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Leave Balance
            </CardTitle>
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">18 Days</div>
            <p className="text-xs text-muted-foreground">Annual leave remaining</p>
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
            <div className="text-2xl font-bold">0</div>
            <p className="text-xs text-muted-foreground">Leave requests pending</p>
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
          <CardDescription>Your next 7 days at a glance</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-2">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, index) => (
              <div
                key={day}
                className="flex flex-col items-center p-3 rounded-lg bg-muted/50"
              >
                <span className="text-xs text-muted-foreground mb-1">{day}</span>
                <span className="text-sm font-medium">
                  {index === 5 || index === 6 ? 'OFF' : index % 2 === 0 ? 'D' : 'N'}
                </span>
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
    </div>
  );
}