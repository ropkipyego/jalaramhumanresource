import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Mail, User, Building2, Shield, Lock, UserPlus, RefreshCw } from "lucide-react";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

const createSchema = z.object({
  email: z.string().email("Invalid email address"),
  fullName: z.string().min(2, "Name must be at least 2 characters"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  staffId: z.string().trim().min(1, "Staff ID is required").max(50),
  role: z.enum(["STAFF", "HEAD", "ADMIN"]),
  departmentId: z.string().optional(),
});

interface Department {
  id: string;
  name: string;
  code: string;
}

const randomPassword = () => {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  let p = "";
  for (let i = 0; i < 10; i++) p += chars[Math.floor(Math.random() * chars.length)];
  return p + "!";
};

const InviteStaff = () => {
  const navigate = useNavigate();
  const { role } = useAuth();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [departments, setDepartments] = useState<Department[]>([]);

  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [staffId, setStaffId] = useState("");
  const [password, setPassword] = useState(randomPassword());
  const [selectedRole, setSelectedRole] = useState<"STAFF" | "HEAD" | "ADMIN">("STAFF");
  const [departmentId, setDepartmentId] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [lastCreated, setLastCreated] = useState<{ email: string; password: string; staffId: string } | null>(null);

  const canAccess = role === "ADMIN" || role === "SUPER_ADMIN";

  useEffect(() => {
    if (!canAccess) {
      navigate("/dashboard");
      return;
    }

    (async () => {
      const { data: depts } = await supabase
        .from("departments")
        .select("id, name, code")
        .eq("is_active", true)
        .order("name");
      setDepartments(depts || []);
      setLoading(false);
    })();
  }, [canAccess, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const payload = {
      email,
      fullName,
      password,
      staffId,
      role: selectedRole,
      departmentId: departmentId || undefined,
    };

    const result = createSchema.safeParse(payload);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        if (err.path[0]) fieldErrors[err.path[0] as string] = err.message;
      });
      setErrors(fieldErrors);
      return;
    }

    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-staff-user", { body: payload });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setLastCreated({ email, password, staffId });
      toast({
        title: "Account Created",
        description: `${email} can log in now. Share their password securely.`,
      });

      setEmail("");
      setFullName("");
      setStaffId("");
      setPassword(randomPassword());
      setSelectedRole("STAFF");
      setDepartmentId("");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to create account",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
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
        <h1 className="text-3xl font-bold">Add Staff Member</h1>
        <p className="text-muted-foreground">Create an account with email, password, role and department</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              New Account
            </CardTitle>
            <CardDescription>The staff member can sign in immediately with the credentials below.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="flex items-center gap-2"><Mail className="h-4 w-4" />Email *</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                  placeholder="staff@hospital.com" className={errors.email ? "border-destructive" : ""} />
                {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="staffId" className="flex items-center gap-2"><Shield className="h-4 w-4" />Staff ID *</Label>
                <Input id="staffId" value={staffId} onChange={(e) => setStaffId(e.target.value)}
                  placeholder="e.g. EMP-0042" className={errors.staffId ? "border-destructive" : ""} />
                {errors.staffId && <p className="text-sm text-destructive">{errors.staffId}</p>}
                <p className="text-xs text-muted-foreground">Used on Excel exports and rota templates.</p>
              </div>


              <div className="space-y-2">
                <Label htmlFor="fullName" className="flex items-center gap-2"><User className="h-4 w-4" />Full Name *</Label>
                <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)}
                  placeholder="Jane Doe" className={errors.fullName ? "border-destructive" : ""} />
                {errors.fullName && <p className="text-sm text-destructive">{errors.fullName}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="flex items-center gap-2"><Lock className="h-4 w-4" />Initial Password *</Label>
                <div className="flex gap-2">
                  <Input id="password" type="text" value={password} onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 8 characters" className={errors.password ? "border-destructive" : ""} />
                  <Button type="button" variant="outline" size="icon" onClick={() => setPassword(randomPassword())} title="Regenerate">
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
                {errors.password && <p className="text-sm text-destructive">{errors.password}</p>}
                <p className="text-xs text-muted-foreground">They can change it after first login.</p>
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2"><Shield className="h-4 w-4" />Role *</Label>
                <Select value={selectedRole} onValueChange={(v) => setSelectedRole(v as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="STAFF">Staff</SelectItem>
                    <SelectItem value="HEAD">Department Head</SelectItem>
                    {role === "SUPER_ADMIN" && <SelectItem value="ADMIN">Admin</SelectItem>}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2"><Building2 className="h-4 w-4" />Department</Label>
                <Select value={departmentId || "none"} onValueChange={(v) => setDepartmentId(v === "none" ? "" : v)}>
                  <SelectTrigger><SelectValue placeholder="Assign a department" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No department</SelectItem>
                    {departments.map((d) => (
                      <SelectItem key={d.id} value={d.id}>{d.name} ({d.code})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creating...</>
                  : <><UserPlus className="mr-2 h-4 w-4" />Create Account</>}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Last Created Credentials</CardTitle>
            <CardDescription>Copy and share with the staff member.</CardDescription>
          </CardHeader>
          <CardContent>
            {lastCreated ? (
              <div className="space-y-3">
                <div className="rounded-lg border p-3">
                  <div className="text-xs text-muted-foreground">Email</div>
                  <div className="font-mono text-sm">{lastCreated.email}</div>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="text-xs text-muted-foreground">Password</div>
                  <div className="font-mono text-sm">{lastCreated.password}</div>
                </div>
                <Button variant="outline" size="sm" className="w-full"
                  onClick={() => navigator.clipboard.writeText(`Email: ${lastCreated.email}\nPassword: ${lastCreated.password}`)}>
                  Copy Both
                </Button>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">No accounts created in this session yet.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default InviteStaff;
