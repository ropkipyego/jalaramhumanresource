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
    const { email, password, fullName, role, departmentId, staffId, phone } = body;

    if (!email || !password) throw new Error("Email and password are required");
    if (password.length < 8) throw new Error("Password must be at least 8 characters");

    const normEmail = email.toLowerCase().trim();

    // Create auth user with confirmed email
    const { data: created, error: createErr } = await supabase.auth.admin.createUser({
      email: normEmail,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
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
