import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Building2, User, Phone, BadgeCheck } from "lucide-react";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

const onboardingSchema = z.object({
  fullName: z.string().min(2, "Full name must be at least 2 characters").max(100),
  phone: z.string().min(10, "Phone must be at least 10 digits").max(20).optional().or(z.literal("")),
  staffId: z.string().min(2, "Staff ID is required").max(50),
  departmentId: z.string().uuid("Please select a department"),
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
}

const Onboarding = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, refreshProfile } = useAuth();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [invitation, setInvitation] = useState<Invitation | null>(null);

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [staffId, setStaffId] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const invitationId = searchParams.get("invitation");

  useEffect(() => {
    const checkProfileAndLoadData = async () => {
      if (!user) {
        navigate("/auth");
        return;
      }

      try {
        // Check if profile already exists and is complete
        const { data: profile } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .single();

        if (profile && profile.full_name && profile.staff_id) {
          // Profile is complete, redirect to dashboard
          navigate("/dashboard");
          return;
        }

        // Load departments
        const { data: depts } = await supabase
          .from("departments")
          .select("id, name, code")
          .eq("is_active", true)
          .order("name");

        setDepartments(depts || []);

        // Load invitation if ID provided
        if (invitationId) {
          const { data: inv } = await supabase
            .from("invitations")
            .select("*")
            .eq("id", invitationId)
            .is("accepted_at", null)
            .single();

          if (inv) {
            setInvitation(inv as Invitation);
            if (inv.full_name) setFullName(inv.full_name);
            if (inv.department_id) setDepartmentId(inv.department_id);
          }
        }

        // Pre-fill from existing profile if partial
        if (profile) {
          if (profile.full_name) setFullName(profile.full_name);
          if (profile.phone) setPhone(profile.phone);
          if (profile.staff_id) setStaffId(profile.staff_id);
        }
      } catch (error) {
        console.error("Error loading onboarding data:", error);
      } finally {
        setLoading(false);
      }
    };

    checkProfileAndLoadData();
  }, [user, navigate, invitationId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    // Validate
    const result = onboardingSchema.safeParse({
      fullName,
      phone: phone || undefined,
      staffId,
      departmentId,
    });

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

    if (!user) {
      toast({ title: "Error", description: "You must be logged in", variant: "destructive" });
      return;
    }

    setSubmitting(true);

    try {
      // Upsert profile
      const { error: profileError } = await supabase
        .from("profiles")
        .upsert({
          id: user.id,
          email: user.email!,
          full_name: fullName,
          phone: phone || null,
          staff_id: staffId,
        });

      if (profileError) {
        throw profileError;
      }

      // Create employee department assignment
      const { error: deptError } = await supabase
        .from("employee_departments")
        .insert({
          employee_id: user.id,
          department_id: departmentId,
          is_primary: true,
          is_head: false,
        });

      if (deptError && !deptError.message.includes("duplicate")) {
        console.error("Department assignment error:", deptError);
      }

      // If invitation exists, mark it as accepted and assign role
      if (invitation) {
        // Mark invitation as accepted
        await supabase
          .from("invitations")
          .update({ accepted_at: new Date().toISOString() })
          .eq("id", invitation.id);
      }

      // Assign default STAFF role if no role exists
      const { data: existingRole } = await supabase
        .from("user_roles")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (!existingRole) {
        const roleToAssign: AppRole = invitation?.role || "STAFF";
        await supabase
          .from("user_roles")
          .insert([{
            user_id: user.id,
            role: roleToAssign,
          }]);
      }

      await refreshProfile();

      toast({
        title: "Welcome!",
        description: "Your profile has been set up successfully.",
      });

      navigate("/dashboard");
    } catch (error: any) {
      console.error("Onboarding error:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to complete setup",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
            <BadgeCheck className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-2xl">Complete Your Profile</CardTitle>
          <CardDescription>
            {invitation
              ? `Welcome! Please complete your profile to get started.`
              : "Please fill in your details to continue."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fullName" className="flex items-center gap-2">
                <User className="h-4 w-4" />
                Full Name
              </Label>
              <Input
                id="fullName"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Enter your full name"
                className={errors.fullName ? "border-destructive" : ""}
              />
              {errors.fullName && (
                <p className="text-sm text-destructive">{errors.fullName}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone" className="flex items-center gap-2">
                <Phone className="h-4 w-4" />
                Phone Number (Optional)
              </Label>
              <Input
                id="phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Enter your phone number"
                className={errors.phone ? "border-destructive" : ""}
              />
              {errors.phone && (
                <p className="text-sm text-destructive">{errors.phone}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="staffId" className="flex items-center gap-2">
                <BadgeCheck className="h-4 w-4" />
                Staff ID
              </Label>
              <Input
                id="staffId"
                value={staffId}
                onChange={(e) => setStaffId(e.target.value)}
                placeholder="Enter your staff ID"
                className={errors.staffId ? "border-destructive" : ""}
              />
              {errors.staffId && (
                <p className="text-sm text-destructive">{errors.staffId}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="department" className="flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Department
              </Label>
              <Select value={departmentId} onValueChange={setDepartmentId}>
                <SelectTrigger className={errors.departmentId ? "border-destructive" : ""}>
                  <SelectValue placeholder="Select your department" />
                </SelectTrigger>
                <SelectContent>
                  {departments.map((dept) => (
                    <SelectItem key={dept.id} value={dept.id}>
                      {dept.name} ({dept.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.departmentId && (
                <p className="text-sm text-destructive">{errors.departmentId}</p>
              )}
            </div>

            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Setting up...
                </>
              ) : (
                "Complete Setup"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default Onboarding;
