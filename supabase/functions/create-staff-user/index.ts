import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CreateUserRequest {
  email: string;
  password: string;
  fullName?: string;
  role?: string;
  departmentId?: string;
  staffId?: string;
  phone?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Unauthorized");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (authError || !user) throw new Error("Unauthorized");

    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .in("role", ["ADMIN", "SUPER_ADMIN"])
      .maybeSingle();
    if (!roleData) throw new Error("Insufficient permissions");

    const body: CreateUserRequest = await req.json();
    const { password, fullName, departmentId, staffId, phone } = body;
    let { email, role } = body;
    role = (role || "STAFF").toUpperCase();

    const callerIsSuper = roleData.role === "SUPER_ADMIN";
    const allowedRoles = callerIsSuper
      ? new Set(["STAFF", "HEAD", "ADMIN", "FINANCE_ADMIN", "SUPER_ADMIN"])
      : new Set(["STAFF", "HEAD", "ADMIN"]);
    if (!allowedRoles.has(role)) {
      throw new Error(`Role "${role}" is not allowed for your account`);
    }

    if (!email || !password) throw new Error("Email and password are required");
    if (password.length < 8) throw new Error("Password must be at least 8 characters");

    const EMAIL_DOMAIN = "jalaram.co.ke";
    const normEmail = email.toLowerCase().trim();
    if (!normEmail.endsWith(`@${EMAIL_DOMAIN}`)) {
      throw new Error(`Email must use @${EMAIL_DOMAIN}`);
    }
    const normStaffId = staffId?.trim() || null;

    // Duplicate checks
    if (normStaffId) {
      const { data: existingStaff } = await supabase
        .from("profiles").select("id").eq("staff_id", normStaffId).maybeSingle();
      if (existingStaff) throw new Error(`Staff ID "${normStaffId}" is already in use`);
    }
    const { data: existingEmail } = await supabase
      .from("profiles").select("id").eq("email", normEmail).maybeSingle();
    if (existingEmail) throw new Error(`Email "${normEmail}" is already in use`);

    // Create auth user with confirmed email (pass staff_id so trigger uses it)
    const { data: created, error: createErr } = await supabase.auth.admin.createUser({
      email: normEmail,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName, staff_id: normStaffId },
    });
    if (createErr) throw new Error(createErr.message);

    const newUserId = created.user.id;

    // Upsert profile
    const { error: profileErr } = await supabase.from("profiles").upsert({
      id: newUserId,
      email: normEmail,
      full_name: fullName || null,
      staff_id: staffId || null,
      phone: phone || null,
      must_change_password: true,
    });
    if (profileErr) console.error("Profile upsert error:", profileErr);

    // Assign role
    const { error: roleErr } = await supabase.from("user_roles").insert({
      user_id: newUserId,
      role: role || "STAFF",
    });
    if (roleErr) console.error("Role insert error:", roleErr);

    // Department assignment
    if (departmentId) {
      await supabase.from("employee_departments").insert({
        employee_id: newUserId,
        department_id: departmentId,
      });
    }

    return new Response(
      JSON.stringify({ success: true, userId: newUserId, email: normEmail }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("create-staff-user error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
