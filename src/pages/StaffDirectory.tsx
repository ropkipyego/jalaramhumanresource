import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRole } from '@/hooks/useRole';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { Users, Search, Edit, Shield, Building2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type { Profile, Department, AppRole, EmployeeDepartment } from '@/types/database';

interface StaffMember extends Profile {
  role?: AppRole;
  departments: (EmployeeDepartment & { department: Department })[];
}

const ROLE_OPTIONS: { value: AppRole; label: string; color: string }[] = [
  { value: 'STAFF', label: 'Staff', color: 'bg-secondary text-secondary-foreground' },
  { value: 'HEAD', label: 'Department Head', color: 'bg-[hsl(var(--info))] text-[hsl(var(--info-foreground))]' },
  { value: 'ADMIN', label: 'Admin', color: 'bg-[hsl(var(--warning))] text-[hsl(var(--warning-foreground))]' },
  { value: 'SUPER_ADMIN', label: 'Super Admin', color: 'bg-destructive text-destructive-foreground' },
];

export default function StaffDirectory() {
  const { user } = useAuth();
  const { hasRole, isSuperAdmin } = useRole();

  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [allDepartments, setAllDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Edit dialogs
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null);
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [deptDialogOpen, setDeptDialogOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<AppRole>('STAFF');
  const [selectedDepts, setSelectedDepts] = useState<Map<string, { isPrimary: boolean; isHead: boolean }>>(new Map());
  const [isSaving, setIsSaving] = useState(false);

  const isAdmin = hasRole('ADMIN');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch all departments
      const { data: deptsData } = await supabase
        .from('departments')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (deptsData) {
        setAllDepartments(deptsData as Department[]);
      }

      // Fetch all profiles with their roles and departments
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .order('full_name');

      if (profilesError) throw profilesError;

      // Fetch roles for all users (admin only)
      let rolesMap = new Map<string, AppRole>();
      if (isAdmin) {
        const { data: rolesData } = await supabase
          .from('user_roles')
          .select('user_id, role');

        if (rolesData) {
          rolesData.forEach((r) => {
            rolesMap.set(r.user_id, r.role as AppRole);
          });
        }
      }

      // Fetch department assignments for all users
      const { data: deptAssignments } = await supabase
        .from('employee_departments')
        .select('*, department:departments(*)');

      const deptMap = new Map<string, (EmployeeDepartment & { department: Department })[]>();
      if (deptAssignments) {
        deptAssignments.forEach((da) => {
          const typed = da as unknown as EmployeeDepartment & { department: Department };
          const existing = deptMap.get(typed.employee_id) || [];
          existing.push(typed);
          deptMap.set(typed.employee_id, existing);
        });
      }

      // Combine data
      const staffList: StaffMember[] = (profilesData || []).map((p) => ({
        ...(p as Profile),
        role: rolesMap.get(p.id) || undefined,
        departments: deptMap.get(p.id) || [],
      }));

      setStaff(staffList);
    } catch (error) {
      console.error('Error fetching staff:', error);
      toast.error('Failed to load staff directory');
    } finally {
      setLoading(false);
    }
  };

  const filteredStaff = staff.filter((s) => {
    const query = searchQuery.toLowerCase();
    return (
      s.full_name.toLowerCase().includes(query) ||
      s.email.toLowerCase().includes(query) ||
      s.staff_id.toLowerCase().includes(query) ||
      s.departments.some((d) => d.department.name.toLowerCase().includes(query))
    );
  });

  const openRoleDialog = (member: StaffMember) => {
    setEditingStaff(member);
    setSelectedRole(member.role || 'STAFF');
    setRoleDialogOpen(true);
  };

  const openDeptDialog = (member: StaffMember) => {
    setEditingStaff(member);
    const deptMap = new Map<string, { isPrimary: boolean; isHead: boolean }>();
    member.departments.forEach((d) => {
      deptMap.set(d.department_id, { isPrimary: d.is_primary, isHead: d.is_head });
    });
    setSelectedDepts(deptMap);
    setDeptDialogOpen(true);
  };

  const saveRole = async () => {
    if (!editingStaff) return;
    setIsSaving(true);

    try {
      // Check if role exists
      const { data: existing } = await supabase
        .from('user_roles')
        .select('id')
        .eq('user_id', editingStaff.id)
        .maybeSingle();

      if (existing) {
        // Update
        const { error } = await supabase
          .from('user_roles')
          .update({ role: selectedRole })
          .eq('user_id', editingStaff.id);
        if (error) throw error;
      } else {
        // Insert
        const { error } = await supabase
          .from('user_roles')
          .insert({ user_id: editingStaff.id, role: selectedRole });
        if (error) throw error;
      }

      // Update local state
      setStaff((prev) =>
        prev.map((s) => (s.id === editingStaff.id ? { ...s, role: selectedRole } : s))
      );

      toast.success('Role updated successfully');
      setRoleDialogOpen(false);
    } catch (error) {
      console.error('Error saving role:', error);
      toast.error('Failed to update role');
    } finally {
      setIsSaving(false);
    }
  };

  const saveDepartments = async () => {
    if (!editingStaff) return;
    setIsSaving(true);

    try {
      // Delete existing assignments
      await supabase
        .from('employee_departments')
        .delete()
        .eq('employee_id', editingStaff.id);

      // Insert new assignments
      const newAssignments = Array.from(selectedDepts.entries()).map(([deptId, { isPrimary, isHead }]) => ({
        employee_id: editingStaff.id,
        department_id: deptId,
        is_primary: isPrimary,
        is_head: isHead,
      }));

      if (newAssignments.length > 0) {
        const { error } = await supabase.from('employee_departments').insert(newAssignments);
        if (error) throw error;
      }

      // Refresh to get updated department data
      await fetchData();

      toast.success('Departments updated successfully');
      setDeptDialogOpen(false);
    } catch (error) {
      console.error('Error saving departments:', error);
      toast.error('Failed to update departments');
    } finally {
      setIsSaving(false);
    }
  };

  const toggleDepartment = (deptId: string) => {
    setSelectedDepts((prev) => {
      const next = new Map(prev);
      if (next.has(deptId)) {
        next.delete(deptId);
      } else {
        next.set(deptId, { isPrimary: false, isHead: false });
      }
      return next;
    });
  };

  const setPrimaryDepartment = (deptId: string) => {
    setSelectedDepts((prev) => {
      const next = new Map(prev);
      next.forEach((value, key) => {
        next.set(key, { ...value, isPrimary: key === deptId });
      });
      return next;
    });
  };

  const toggleHead = (deptId: string) => {
    setSelectedDepts((prev) => {
      const next = new Map(prev);
      const current = next.get(deptId);
      if (current) {
        next.set(deptId, { ...current, isHead: !current.isHead });
      }
      return next;
    });
  };

  const getRoleBadge = (role?: AppRole) => {
    const roleOption = ROLE_OPTIONS.find((r) => r.value === role);
    if (!roleOption) return <Badge variant="secondary">No Role</Badge>;
    return <Badge className={roleOption.color}>{roleOption.label}</Badge>;
  };

  if (!hasRole('HEAD')) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Staff Directory</h1>
          <p className="text-muted-foreground">View staff members</p>
        </div>
        <Card>
          <CardContent className="py-10 text-center">
            <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Access Restricted</h3>
            <p className="text-muted-foreground">
              You don't have permission to view the staff directory.
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
          <h1 className="text-2xl font-bold tracking-tight">Staff Directory</h1>
          <p className="text-muted-foreground">
            {isAdmin ? 'Manage staff members, roles and departments' : 'View staff members'}
          </p>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-lg">All Staff</CardTitle>
              <CardDescription>{staff.length} total members</CardDescription>
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search staff..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : filteredStaff.length === 0 ? (
            <div className="py-10 text-center">
              <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                {searchQuery ? 'No staff found matching your search.' : 'No staff members found.'}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Staff Member</TableHead>
                  <TableHead>Staff ID</TableHead>
                  <TableHead>Departments</TableHead>
                  {isAdmin && <TableHead>Role</TableHead>}
                  <TableHead>Status</TableHead>
                  {isAdmin && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStaff.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium text-sm">
                          {member.full_name
                            .split(' ')
                            .map((n) => n[0])
                            .join('')
                            .slice(0, 2)
                            .toUpperCase()}
                        </div>
                        <div>
                          <div className="font-medium">{member.full_name}</div>
                          <div className="text-xs text-muted-foreground">{member.email}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{member.staff_id}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {member.departments.length === 0 ? (
                          <span className="text-xs text-muted-foreground">None</span>
                        ) : (
                          member.departments.map((d) => (
                            <Badge
                              key={d.id}
                              variant={d.is_primary ? 'default' : 'outline'}
                              className="text-xs"
                            >
                              {d.department.name}
                              {d.is_head && ' (Head)'}
                            </Badge>
                          ))
                        )}
                      </div>
                    </TableCell>
                    {isAdmin && <TableCell>{getRoleBadge(member.role)}</TableCell>}
                    <TableCell>
                      <Badge variant={member.is_active ? 'default' : 'secondary'}>
                        {member.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    {isAdmin && (
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openDeptDialog(member)}
                            title="Edit Departments"
                          >
                            <Building2 className="h-4 w-4" />
                          </Button>
                          {isSuperAdmin && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openRoleDialog(member)}
                              title="Edit Role"
                            >
                              <Shield className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Role Edit Dialog */}
      <Dialog open={roleDialogOpen} onOpenChange={setRoleDialogOpen}>
        <DialogContent className="bg-background">
          <DialogHeader>
            <DialogTitle>Edit Role</DialogTitle>
            <DialogDescription>
              Change the role for {editingStaff?.full_name}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Select value={selectedRole} onValueChange={(v) => setSelectedRole(v as AppRole)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-popover z-50">
                {ROLE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    <div className="flex items-center gap-2">
                      <Badge className={option.color}>{option.label}</Badge>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRoleDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveRole} disabled={isSaving}>
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Department Edit Dialog */}
      <Dialog open={deptDialogOpen} onOpenChange={setDeptDialogOpen}>
        <DialogContent className="bg-background max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Departments</DialogTitle>
            <DialogDescription>
              Assign departments for {editingStaff?.full_name}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4 max-h-[400px] overflow-y-auto">
            {allDepartments.map((dept) => {
              const isSelected = selectedDepts.has(dept.id);
              const deptConfig = selectedDepts.get(dept.id);

              return (
                <div
                  key={dept.id}
                  className={`p-3 rounded-lg border ${isSelected ? 'bg-accent/30 border-primary/30' : ''}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleDepartment(dept.id)}
                      />
                      <div>
                        <div className="font-medium">{dept.name}</div>
                        <div className="text-xs text-muted-foreground">{dept.code}</div>
                      </div>
                    </div>
                  </div>
                  {isSelected && (
                    <div className="mt-3 ml-7 flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant={deptConfig?.isPrimary ? 'default' : 'outline'}
                        onClick={() => setPrimaryDepartment(dept.id)}
                      >
                        Primary
                      </Button>
                      <Button
                        size="sm"
                        variant={deptConfig?.isHead ? 'default' : 'outline'}
                        onClick={() => toggleHead(dept.id)}
                      >
                        Department Head
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
            {allDepartments.length === 0 && (
              <p className="text-muted-foreground text-center py-4">No departments available</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeptDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveDepartments} disabled={isSaving}>
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
