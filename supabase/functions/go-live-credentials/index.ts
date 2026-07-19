import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const DEFAULT_TEMP_PASSWORD = "ChangeMe123!";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
    if (!roleData) throw new Error("Only ADMIN or SUPER_ADMIN can manage go-live credentials");

    const body = await req.json().catch(() => ({}));
    const action = (body.action || "list") as string;

    // Load staff profiles + roles
    const { data: profiles, error: pErr } = await supabase
      .from("profiles")
      .select("id, staff_id, full_name, email, is_active, hr_status, phone")
      .order("full_name");
    if (pErr) throw new Error(pErr.message);

    const { data: roles } = await supabase.from("user_roles").select("user_id, role");
    const roleMap = new Map((roles || []).map((r) => [r.user_id, r.role]));

    // Auth users for last_sign_in
    const authUsers: Record<string, { email?: string; last_sign_in_at?: string; email_confirmed_at?: string }> = {};
    let page = 1;
    for (;;) {
      const { data: listed, error: listErr } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
      if (listErr) throw new Error(listErr.message);
      for (const u of listed.users) {
        authUsers[u.id] = {
          email: u.email,
          last_sign_in_at: u.last_sign_in_at,
          email_confirmed_at: u.email_confirmed_at,
        };
      }
      if (listed.users.length < 200) break;
      page += 1;
      if (page > 50) break;
    }

    const roster = (profiles || []).map((p) => ({
      id: p.id,
      staff_id: p.staff_id,
      full_name: p.full_name,
      email: p.email,
      phone: p.phone,
      is_active: p.is_active,
      hr_status: p.hr_status,
      role: roleMap.get(p.id) || "STAFF",
      has_auth_account: !!authUsers[p.id],
      last_sign_in_at: authUsers[p.id]?.last_sign_in_at || null,
      login_email: authUsers[p.id]?.email || p.email,
    }));

    if (action === "list") {
      return new Response(JSON.stringify({ staff: roster, count: roster.length }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    if (action === "reset_passwords") {
      const ids: string[] = Array.isArray(body.user_ids) ? body.user_ids : [];
      const targetIds = ids.length > 0 ? ids : roster.filter((r) => r.has_auth_account && r.is_active).map((r) => r.id);

      const credentials: Array<{
        staff_id: string;
        full_name: string;
        email: string;
        role: string;
        password: string;
        status: "reset" | "error" | "skipped";
        reason?: string;
      }> = [];

      for (const id of targetIds) {
        const row = roster.find((r) => r.id === id);
        if (!row) {
          credentials.push({ staff_id: "", full_name: "", email: "", role: "", password: "", status: "skipped", reason: "Not found" });
          continue;
        }
        if (!row.has_auth_account) {
          credentials.push({
            staff_id: row.staff_id,
            full_name: row.full_name,
            email: row.login_email,
            role: row.role,
            password: "",
            status: "skipped",
            reason: "No auth account — create user via Invite Staff first",
          });
          continue;
        }

        const password = (typeof body.password === "string" && body.password.length >= 8)
          ? body.password
          : DEFAULT_TEMP_PASSWORD;
        const { error: upErr } = await supabase.auth.admin.updateUserById(id, {
          password,
          email_confirm: true,
        });

        if (upErr) {
          credentials.push({
            staff_id: row.staff_id,
            full_name: row.full_name,
            email: row.login_email,
            role: row.role,
            password: "",
            status: "error",
            reason: upErr.message,
          });
        } else {
          credentials.push({
            staff_id: row.staff_id,
            full_name: row.full_name,
            email: row.login_email,
            role: row.role,
            password,
            status: "reset",
          });
          await supabase.from("profiles").update({ must_change_password: true }).eq("id", id);
          await supabase.rpc("log_audit", {
            _action: "password_reset_go_live",
            _table_name: "auth.users",
            _record_id: id,
            _new_data: { by: user.id, staff_id: row.staff_id },
          }).catch(() => null);
        }
      }

      return new Response(
        JSON.stringify({
          credentials,
          reset_count: credentials.filter((c) => c.status === "reset").length,
          skipped_count: credentials.filter((c) => c.status === "skipped").length,
          error_count: credentials.filter((c) => c.status === "error").length,
          warning: "Download this file now. Passwords cannot be retrieved later — they are hashed in the database.",
        }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (action === "update_email") {
      const userId = body.user_id as string;
      const rawEmail = (body.email || "").toString().toLowerCase().trim();
      if (!userId) throw new Error("user_id is required");
      if (!rawEmail.includes("@") || !rawEmail.endsWith("@jalaram.co.ke")) {
        throw new Error("Email must be a valid @jalaram.co.ke address");
      }

      const { data: dup } = await supabase
        .from("profiles")
        .select("id")
        .eq("email", rawEmail)
        .neq("id", userId)
        .maybeSingle();
      if (dup) throw new Error(`Email ${rawEmail} is already used by another staff member`);

      const { error: authErr } = await supabase.auth.admin.updateUserById(userId, {
        email: rawEmail,
        email_confirm: true,
      });
      if (authErr) throw new Error(authErr.message);

      const { error: profErr } = await supabase
        .from("profiles")
        .update({ email: rawEmail })
        .eq("id", userId);
      if (profErr) throw new Error(profErr.message);

      await supabase.rpc("log_audit", {
        _action: "staff_email_corrected",
        _table_name: "profiles",
        _record_id: userId,
        _new_data: { email: rawEmail, by: user.id },
      }).catch(() => null);

      return new Response(
        JSON.stringify({ success: true, email: rawEmail }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    throw new Error(`Unknown action: ${action}`);
  } catch (error: any) {
    console.error("go-live-credentials error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
