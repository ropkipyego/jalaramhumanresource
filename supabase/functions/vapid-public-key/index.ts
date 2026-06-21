import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "https://esm.sh/web-push@3.6.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Returns VAPID public key. Generates+stores a keypair on first call.
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    let { data: existing } = await supabase.from("app_settings").select("value").eq("key", "vapid").maybeSingle();

    if (!existing) {
      const keys = webpush.generateVAPIDKeys();
      await supabase.from("app_settings").upsert({
        key: "vapid",
        value: { publicKey: keys.publicKey, privateKey: keys.privateKey, subject: "mailto:admin@hospital.local" },
      });
      existing = { value: { publicKey: keys.publicKey } } as any;
    }

    const publicKey = (existing!.value as any).publicKey;
    return new Response(JSON.stringify({ publicKey }), {
      status: 200, headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
