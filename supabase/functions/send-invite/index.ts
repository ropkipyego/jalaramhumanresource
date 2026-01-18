import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface InviteRequest {
  email: string;
  fullName?: string;
  role: string;
  departmentId?: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get auth header for user verification
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    // Create Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify user is admin
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      throw new Error("Unauthorized");
    }

    // Check if user has admin role
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .in("role", ["ADMIN", "SUPER_ADMIN"])
      .single();

    if (!roleData) {
      throw new Error("Insufficient permissions");
    }

    const { email, fullName, role, departmentId }: InviteRequest = await req.json();

    if (!email) {
      throw new Error("Email is required");
    }

    console.log(`Creating invitation for ${email}`);

    // Check if invitation already exists
    const { data: existingInvite } = await supabase
      .from("invitations")
      .select("id")
      .eq("email", email.toLowerCase())
      .is("accepted_at", null)
      .single();

    if (existingInvite) {
      throw new Error("An invitation for this email already exists");
    }

    // Check if user already exists in profiles
    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("id")
      .eq("email", email.toLowerCase())
      .single();

    if (existingProfile) {
      throw new Error("A user with this email already exists");
    }

    // Create invitation
    const { data: invitation, error: insertError } = await supabase
      .from("invitations")
      .insert({
        email: email.toLowerCase(),
        full_name: fullName,
        role: role || "STAFF",
        department_id: departmentId || null,
        invited_by: user.id,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Insert error:", insertError);
      throw new Error("Failed to create invitation");
    }

    console.log(`Invitation created with ID: ${invitation.id}`);

    // Generate magic link using Supabase Auth
    const siteUrl = Deno.env.get("SITE_URL") || "https://id-preview--e3c3c974-5669-4563-8a44-1bea945fe9bd.lovable.app";
    
    const { data: magicLinkData, error: magicLinkError } = await supabase.auth.admin.generateLink({
      type: "magiclink",
      email: email.toLowerCase(),
      options: {
        redirectTo: `${siteUrl}/onboarding?invitation=${invitation.id}`,
      },
    });

    if (magicLinkError) {
      console.error("Magic link error:", magicLinkError);
      throw new Error("Failed to generate magic link");
    }

    const magicLink = magicLinkData.properties.action_link;
    console.log(`Magic link generated for ${email}`);

    // Send email via Resend
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      throw new Error("RESEND_API_KEY not configured");
    }

    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #0d9488, #14b8a6); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
            .button { display: inline-block; background: #0d9488; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; margin: 20px 0; }
            .footer { text-align: center; margin-top: 20px; color: #666; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🏥 Hospital Rota Manager</h1>
            </div>
            <div class="content">
              <h2>Welcome${fullName ? `, ${fullName}` : ''}!</h2>
              <p>You've been invited to join the Hospital Rota Manager system as a <strong>${role || 'STAFF'}</strong> member.</p>
              <p>Click the button below to complete your registration:</p>
              <p style="text-align: center;">
                <a href="${magicLink}" class="button">Complete Registration</a>
              </p>
              <p><strong>This link will expire in 7 days.</strong></p>
              <p>If you didn't expect this invitation, you can safely ignore this email.</p>
            </div>
            <div class="footer">
              <p>Hospital Rota Manager - Staff Scheduling System</p>
            </div>
          </div>
        </body>
      </html>
    `;

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Hospital Rota <onboarding@resend.dev>",
        to: [email],
        subject: "You've been invited to Hospital Rota Manager",
        html: emailHtml,
      }),
    });

    if (!emailResponse.ok) {
      const errorText = await emailResponse.text();
      console.error("Resend error:", errorText);
      throw new Error("Failed to send invitation email");
    }

    const emailResult = await emailResponse.json();
    console.log("Email sent successfully:", emailResult);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Invitation sent successfully",
        invitationId: invitation.id 
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in send-invite function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: error.message === "Unauthorized" || error.message === "Insufficient permissions" ? 403 : 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
