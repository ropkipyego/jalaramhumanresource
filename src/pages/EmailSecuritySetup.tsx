import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useRole } from "@/hooks/useRole";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { STAFF_EMAIL_DOMAIN } from "@/lib/staffEmail";
import { Mail, Shield, Server, CheckCircle2, Circle } from "lucide-react";

export default function EmailSecuritySetup() {
  const { isSuperAdmin } = useRole();
  if (!isSuperAdmin) return <Navigate to="/dashboard" replace />;

  const checklist = [
    { id: "dns", title: "DNS ownership of jalaram.co.ke", detail: "You control the domain at your registrar (e.g. Cloudflare, cPanel)." },
    { id: "spf", title: "SPF record", detail: "TXT @ → v=spf1 include:_spf.resend.com ~all  (or your SMTP provider’s include)" },
    { id: "dkim", title: "DKIM records", detail: "Add the CNAME/TXT records Resend (or Google Workspace / Microsoft 365) shows after domain verify." },
    { id: "dmarc", title: "DMARC record", detail: "TXT _dmarc → v=DMARC1; p=none; rua=mailto:admin@jalaram.co.ke" },
    { id: "resend", title: "Resend API key (optional)", detail: "Only if you want app invite emails. Create at resend.com → Domains → jalaram.co.ke → secret RESEND_API_KEY. Skip if using SMTP-only for now." },
    { id: "smtp", title: "Supabase Auth SMTP (password resets)", detail: "Supabase Dashboard → Authentication → SMTP: host, port 587, username, password, sender noreply@jalaram.co.ke" },
    { id: "from", title: "From address", detail: "Use noreply@jalaram.co.ke or hr@jalaram.co.ke (must match verified domain)." },
  ];

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-3xl font-bold">Email &amp; Security Setup</h1>
        <p className="text-muted-foreground">
          Staff logins use <Badge variant="outline">@{STAFF_EMAIL_DOMAIN}</Badge>. Complete this checklist so invites and password resets actually arrive.
        </p>
      </div>

      <Alert>
        <Mail className="h-4 w-4" />
        <AlertTitle>What we need from your email / IT team</AlertTitle>
        <AlertDescription className="space-y-2 mt-2 text-sm">
          <p><strong>Resend is optional</strong> — only needed if you want invite emails from the app today. Password resets can use Workspace/365 SMTP alone.</p>
          <p className="pt-2"><strong>Option A — Resend (invite emails; already coded):</strong></p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Access to DNS for <code>jalaram.co.ke</code></li>
            <li>Resend account + verified domain</li>
            <li>API key → Supabase Edge Function secret <code>RESEND_API_KEY</code></li>
          </ul>
          <p className="pt-2"><strong>Option B — Google Workspace / Microsoft 365 SMTP:</strong></p>
          <ul className="list-disc pl-5 space-y-1">
            <li>SMTP host (e.g. <code>smtp.gmail.com</code> or <code>smtp.office365.com</code>)</li>
            <li>Port <code>587</code> (TLS)</li>
            <li>Mailbox username + app password (e.g. <code>noreply@jalaram.co.ke</code>)</li>
            <li>Paste into Supabase → Authentication → SMTP Settings</li>
          </ul>
          <p className="pt-2">
            You do <strong>not</strong> need a custom mail server. DNS + Option B is enough for Auth; add Resend later for invites if you want.
          </p>
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Server className="h-5 w-5" />Go-live checklist</CardTitle>
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
          <CardTitle className="flex items-center gap-2"><Shield className="h-5 w-5" />MFA (built in)</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>
            In Supabase Dashboard → Authentication → Multi-Factor → enable <strong>TOTP</strong>
            (authenticator apps). No phone SMS required.
          </p>
          <p>
            ADMIN, SUPER_ADMIN, and FINANCE_ADMIN are forced to enroll and enter a code after login.
            Staff are not required to use MFA.
          </p>
          <p className="flex items-center gap-2 text-foreground">
            <CheckCircle2 className="h-4 w-4 text-success" />
            App already enforces @{STAFF_EMAIL_DOMAIN} on invite, bulk upload, and signup.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
