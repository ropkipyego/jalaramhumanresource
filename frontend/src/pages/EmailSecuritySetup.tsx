import { Navigate } from "react-router-dom";
import { useRole } from "@/hooks/useRole";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { STAFF_EMAIL_DOMAIN } from "@/lib/staffEmail";
import { Mail, Shield, Server, Circle } from "lucide-react";

export default function EmailSecuritySetup() {
  const { isSuperAdmin } = useRole();
  if (!isSuperAdmin) return <Navigate to="/dashboard" replace />;

  const checklist = [
    { id: "dns", title: "DNS for your email domain", detail: "Control DNS at your registrar (e.g. Cloudflare, cPanel) for the domain staff use to log in." },
    { id: "spf", title: "SPF record (optional, for future email)", detail: "TXT @ → v=spf1 include:your-smtp-provider ~all" },
    { id: "dkim", title: "DKIM records (optional)", detail: "Add records from your SMTP provider when you enable outbound email." },
    { id: "password", title: "Password resets (self-hosted)", detail: "Passwords live in hr.app_credentials on your PostgreSQL server. Admins reset via: ADMIN_EMAIL=... NEW_PASSWORD=... bash scripts/db/reset-admin-password.sh" },
    { id: "storage", title: "Document storage (MinIO)", detail: "Employee documents are stored in MinIO on this server — not Supabase Storage or any cloud bucket." },
  ];

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-3xl font-bold">Email &amp; Security Setup</h1>
        <p className="text-muted-foreground">
          Self-hosted HR at <Badge variant="outline">@{STAFF_EMAIL_DOMAIN}</Badge>. No Supabase Auth, no Lovable cloud, no MFA gate.
        </p>
      </div>

      <Alert>
        <Mail className="h-4 w-4" />
        <AlertTitle>Authentication is fully on your server</AlertTitle>
        <AlertDescription className="space-y-2 mt-2 text-sm">
          <p>Login, JWT sessions, and password hashes are handled by NestJS + PostgreSQL (<code>hr.app_credentials</code>).</p>
          <p>Two-factor / MFA is <strong>not</strong> enabled — admins sign in with email + password only.</p>
          <p>Outbound email (invites, password reset links) is optional and not required for core HR operations.</p>
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Server className="h-5 w-5" />Infrastructure checklist</CardTitle>
          <CardDescription>Work through with IT — tick off outside this app.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {checklist.map((c, i) => (
            <div key={c.id} className="flex gap-3 border rounded-lg p-3">
              <Circle className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
              <div>
                <div className="font-medium text-sm">{i + 1}. {c.title}</div>
                <div className="text-xs text-muted-foreground mt-1">{c.detail}</div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Shield className="h-5 w-5" />Security model</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>Roles (STAFF, HEAD, ADMIN, FINANCE_ADMIN, SUPER_ADMIN) are stored in <code>public.user_roles</code>.</p>
          <p>Refresh tokens are stored in <code>hr.refresh_tokens</code> and can be revoked on logout.</p>
          <p>File uploads go through NestJS → MinIO on this server — not Supabase Storage.</p>
        </CardContent>
      </Card>
    </div>
  );
}
