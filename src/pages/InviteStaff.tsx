import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Mail, User, Building2, Shield, Trash2, Send, Clock, CheckCircle, Lock, UserPlus } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { z } from "zod";
import { format } from "date-fns";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

const inviteSchema = z.object({
  email: z.string().email("Invalid email address"),
  fullName: z.string().min(2, "Name must be at least 2 characters").optional().or(z.literal("")),
  role: z.enum(["STAFF", "HEAD", "ADMIN"]),
  departmentId: z.string().optional(),
});

const createSchema = inviteSchema.extend({
  password: z.string().min(8, "Password must be at least 8 characters"),
});

interface Department {
  id: string;
  name: string;
  code: string;
}

interface Invitation {
  id: string;
  email: string;
  full_name: string | null;
  role: AppRole;
  department_id: string | null;
  department?: { name: string } | null;
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
}

const InviteStaff = () => {
  const navigate = useNavigate();
  const { role } = useAuth();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);

  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"invite" | "create">("invite");
  const [selectedRole, setSelectedRole] = useState<"STAFF" | "HEAD" | "ADMIN">("STAFF");
  const [departmentId, setDepartmentId] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const canAccess = role === "ADMIN" || role === "SUPER_ADMIN";

  useEffect(() => {
    if (!canAccess) {
      navigate("/dashboard");
      return;
    }

    const loadData = async () => {
      try {
        const [{ data: depts }, { data: invites }] = await Promise.all([
          supabase
            .from("departments")
            .select("id, name, code")
            .eq("is_active", true)
            .order("name"),
          supabase
            .from("invitations")
            .select("*, department:departments(name)")
            .order("created_at", { ascending: false }),
        ]);

        setDepartments(depts || []);
        setInvitations((invites || []) as Invitation[]);
      } catch (error) {
        console.error("Error loading data:", error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [canAccess, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const schema = mode === "create" ? createSchema : inviteSchema;
    const payload: any = {
      email,
      fullName: fullName || undefined,
      role: selectedRole,
      departmentId: departmentId || undefined,
    };
    if (mode === "create") payload.password = password;

    const result = schema.safeParse(payload);

    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        if (err.path[0]) {
          fieldErrors[err.path[0] as string] = err.message;
        }
      });
      setErrors(fieldErrors);
      return;
    }

    setSubmitting(true);

    try {
      const fnName = mode === "create" ? "create-staff-user" : "send-invite";
      const { data, error } = await supabase.functions.invoke(fnName, {
        body: payload,
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({
        title: mode === "create" ? "User Created" : "Invitation Sent",
        description: mode === "create"
          ? `${email} can now log in with the password you set`
          : `An invitation email has been sent to ${email}`,
      });

      // Reset form
      setEmail("");
      setFullName("");
      setPassword("");
      setSelectedRole("STAFF");
      setDepartmentId("");

      // Refresh invitations list
      const { data: invites } = await supabase
        .from("invitations")
        .select("*, department:departments(name)")
        .order("created_at", { ascending: false });

      setInvitations((invites || []) as Invitation[]);
    } catch (error: any) {
      console.error("Submit error:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to process request",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (invitationId: string) => {
    try {
      const { error } = await supabase
        .from("invitations")
        .delete()
        .eq("id", invitationId);

      if (error) throw error;

      setInvitations((prev) => prev.filter((inv) => inv.id !== invitationId));

      toast({
        title: "Invitation Deleted",
        description: "The invitation has been removed",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete invitation",
        variant: "destructive",
      });
    }
  };

  const getStatusBadge = (invitation: Invitation) => {
    if (invitation.accepted_at) {
      return (
        <Badge variant="default" className="bg-green-600">
          <CheckCircle className="mr-1 h-3 w-3" />
          Accepted
        </Badge>
      );
    }

    const isExpired = new Date(invitation.expires_at) < new Date();
    if (isExpired) {
      return (
        <Badge variant="destructive">
          Expired
        </Badge>
      );
    }

    return (
      <Badge variant="secondary">
        <Clock className="mr-1 h-3 w-3" />
        Pending
      </Badge>
    );
  };

  const getRoleBadge = (inviteRole: AppRole) => {
    const colors: Record<AppRole, string> = {
      STAFF: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
      HEAD: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300",
      ADMIN: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300",
      SUPER_ADMIN: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
    };
    return <Badge className={colors[inviteRole] || ""}>{inviteRole}</Badge>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Invite Staff</h1>
        <p className="text-muted-foreground">Send invitations to new staff members</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Invite Form */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {mode === "create" ? <UserPlus className="h-5 w-5" /> : <Send className="h-5 w-5" />}
              Add Staff Member
            </CardTitle>
            <CardDescription>
              Send an invitation email or create the account directly with a password
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={mode} onValueChange={(v) => setMode(v as "invite" | "create")} className="mb-4">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="invite">
                  <Mail className="mr-2 h-4 w-4" />
                  Email Invite
                </TabsTrigger>
                <TabsTrigger value="create">
                  <UserPlus className="mr-2 h-4 w-4" />
                  Create Directly
                </TabsTrigger>
              </TabsList>
            </Tabs>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  Email Address *
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="staff@hospital.com"
                  className={errors.email ? "border-destructive" : ""}
                />
                {errors.email && (
                  <p className="text-sm text-destructive">{errors.email}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="fullName" className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Full Name {mode === "create" ? "" : "(Optional)"}
                </Label>
                <Input
                  id="fullName"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Enter their name"
                  className={errors.fullName ? "border-destructive" : ""}
                />
                {errors.fullName && (
                  <p className="text-sm text-destructive">{errors.fullName}</p>
                )}
              </div>

              {mode === "create" && (
                <div className="space-y-2">
                  <Label htmlFor="password" className="flex items-center gap-2">
                    <Lock className="h-4 w-4" />
                    Initial Password *
                  </Label>
                  <Input
                    id="password"
                    type="text"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 8 characters"
                    className={errors.password ? "border-destructive" : ""}
                  />
                  {errors.password && (
                    <p className="text-sm text-destructive">{errors.password}</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Share this password with the staff member. They can change it after logging in.
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="role" className="flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  Role *
                </Label>
                <Select value={selectedRole} onValueChange={(v) => setSelectedRole(v as any)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="STAFF">Staff</SelectItem>
                    <SelectItem value="HEAD">Department Head</SelectItem>
                    {role === "SUPER_ADMIN" && (
                      <SelectItem value="ADMIN">Admin</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="department" className="flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  Department (Optional)
                </Label>
                <Select value={departmentId || "none"} onValueChange={(v) => setDepartmentId(v === "none" ? "" : v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Pre-assign department" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No pre-assignment</SelectItem>
                    {departments.map((dept) => (
                      <SelectItem key={dept.id} value={dept.id}>
                        {dept.name} ({dept.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {mode === "create" ? "Creating..." : "Sending..."}
                  </>
                ) : (
                  <>
                    {mode === "create" ? <UserPlus className="mr-2 h-4 w-4" /> : <Send className="mr-2 h-4 w-4" />}
                    {mode === "create" ? "Create Account" : "Send Invitation"}
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>


        {/* Pending Invitations */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Invitations
            </CardTitle>
            <CardDescription>
              {invitations.length} total invitations
            </CardDescription>
          </CardHeader>
          <CardContent>
            {invitations.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No invitations sent yet
              </p>
            ) : (
              <div className="max-h-[400px] overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invitations.map((invitation) => (
                      <TableRow key={invitation.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{invitation.email}</p>
                            {invitation.full_name && (
                              <p className="text-sm text-muted-foreground">
                                {invitation.full_name}
                              </p>
                            )}
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(invitation.created_at), "MMM d, yyyy")}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>{getRoleBadge(invitation.role)}</TableCell>
                        <TableCell>{getStatusBadge(invitation)}</TableCell>
                        <TableCell>
                          {!invitation.accepted_at && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDelete(invitation.id)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default InviteStaff;
