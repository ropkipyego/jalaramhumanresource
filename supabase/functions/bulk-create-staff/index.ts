import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Row {
  staffId: string;
  fullName: string;
  email: string;
  role?: string;
  departmentName?: string;
  password: string;
}

const VALID_ROLES = new Set(["STAFF", "HEAD", "ADMIN"]);

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
      .from("user_roles").select("role").eq("user_id", user.id)
      .in("role", ["ADMIN", "SUPER_ADMIN"]).maybeSingle();
    if (!roleData) throw new Error("Insufficient permissions");

    const { rows } = (await req.json()) as { rows: Row[] };
    if (!Array.isArray(rows) || rows.length === 0) throw new Error("No rows provided");
    if (rows.length > 500) throw new Error("Maximum 500 rows per upload");

    // Preload departments by lowercased name + code for lookup
    const { data: depts } = await supabase.from("departments").select("id, name, code");
    const deptMap = new Map<string, string>();
    (depts || []).forEach((d) => {
      deptMap.set(d.name.toLowerCase().trim(), d.id);
      if (d.code) deptMap.set(d.code.toLowerCase().trim(), d.id);
    });

    const results: Array<{ row: number; staffId: string; email: string; status: "created" | "skipped" | "error"; reason?: string; password?: string }> = [];

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const rowNum = i + 2; // assuming header row
      const staffId = (r.staffId || "").toString().trim();
      const email = (r.email || "").toString().toLowerCase().trim();
      const fullName = (r.fullName || "").toString().trim();
      const password = (r.password || "").toString();
      const role = (r.role || "STAFF").toString().toUpperCase().trim();
      const deptKey = (r.departmentName || "").toString().toLowerCase().trim();

      try {
        if (!staffId) throw new Error("Missing Staff ID");
        if (!email || !email.includes("@")) throw new Error("Invalid email");
        if (!fullName) throw new Error("Missing full name");
        if (!password || password.length < 8) throw new Error("Password must be 8+ chars");
        if (!VALID_ROLES.has(role)) throw new Error(`Invalid role "${role}"`);

        // Duplicate checks → skip
        const { data: dupStaff } = await supabase.from("profiles").select("id").eq("staff_id", staffId).maybeSingle();
        if (dupStaff) { results.push({ row: rowNum, staffId, email, status: "skipped", reason: "Staff ID exists" }); continue; }
        const { data: dupEmail } = await supabase.from("profiles").select("id").eq("email", email).maybeSingle();
        if (dupEmail) { results.push({ row: rowNum, staffId, email, status: "skipped", reason: "Email exists" }); continue; }

        const departmentId = deptKey ? deptMap.get(deptKey) : undefined;
        if (deptKey && !departmentId) throw new Error(`Unknown department "${r.departmentName}"`);

        const { data: created, error: createErr } = await supabase.auth.admin.createUser({
          email, password, email_confirm: true,
          user_metadata: { full_name: fullName, staff_id: staffId },
        });
        if (createErr) throw new Error(createErr.message);
        const newUserId = created.user.id;

        await supabase.from("profiles").upsert({
          id: newUserId, email, full_name: fullName, staff_id: staffId,
        });
        await supabase.from("user_roles").insert({ user_id: newUserId, role });
        if (departmentId) {
          await supabase.from("employee_departments").insert({
            employee_id: newUserId, department_id: departmentId,
          });
        }
        results.push({ row: rowNum, staffId, email, status: "created", password });
      } catch (err: any) {
        results.push({ row: rowNum, staffId, email, status: "error", reason: err.message });
      }
    }

    const summary = {
      total: results.length,
      created: results.filter((r) => r.status === "created").length,
      skipped: results.filter((r) => r.status === "skipped").length,
      errors: results.filter((r) => r.status === "error").length,
    };

    return new Response(JSON.stringify({ success: true, summary, results }), {
      status: 200, headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("bulk-create-staff error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400, headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
