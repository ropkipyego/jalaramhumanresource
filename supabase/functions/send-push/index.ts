import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "https://esm.sh/web-push@3.6.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Sends a web push to one or more user IDs. Requires authenticated caller (any signed-in user
// can trigger; the bodies are for app events, not arbitrary spam — restrict in clients).
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Unauthorized");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const { data: { user }, error: authErr } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authErr || !user) throw new Error("Unauthorized");

    const { userIds, title, body, url, tag } = await req.json();
    if (!Array.isArray(userIds) || userIds.length === 0) throw new Error("userIds required");
    if (!title) throw new Error("title required");

    const { data: vapid } = await supabase.from("app_settings").select("value").eq("key", "vapid").maybeSingle();
    if (!vapid) throw new Error("VAPID keys not initialised — open Settings to enable push first");
    const v = vapid.value as any;
    webpush.setVapidDetails(v.subject || "mailto:admin@hospital.local", v.publicKey, v.privateKey);

    const { data: subs } = await supabase
      .from("push_subscriptions").select("*").in("user_id", userIds);

    const payload = JSON.stringify({ title, body, url: url || "/", tag });
    const results = await Promise.all((subs || []).map(async (s: any) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload
        );
        return { endpoint: s.endpoint, ok: true };
      } catch (err: any) {
        // Clean up dead subscriptions
        if (err.statusCode === 404 || err.statusCode === 410) {
          await supabase.from("push_subscriptions").delete().eq("endpoint", s.endpoint);
        }
        return { endpoint: s.endpoint, ok: false, status: err.statusCode, error: err.message };
      }
    }));

    return new Response(JSON.stringify({ sent: results.filter(r => r.ok).length, total: results.length, results }), {
      status: 200, headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 400, headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
