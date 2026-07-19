import { Navigate, Link } from "react-router-dom";
import { useRole } from "@/hooks/useRole";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { STAFF_EMAIL_DOMAIN } from "@/lib/staffEmail";
import {
  CheckCircle2, Circle, Rocket, Database, Shield, Users, Calculator, Clock,
} from "lucide-react";

type Item = { title: string; detail: string; href?: string; owner: string };

const DEPLOY: Item[] = [
  {
    title: "Run go-live SQL in Supabase",
    detail:
      "Dashboard → SQL Editor → New query → paste entire file scripts/supabase-go-live.sql → Run. Adds must_change_password + OT payroll gate + security hardening.",
    owner: "Dev / you",
  },
  {
    title: "Disable public signup in Supabase",
    detail: "Authentication → Providers → Email → turn OFF “Enable sign ups” (app already blocks signup).",
    owner: "Dev",
  },
  { title: "Enable Supabase MFA (TOTP)", detail: "Authentication → Multi-Factor → TOTP (admins can enroll in-app)", owner: "Dev" },
  { title: "Configure Auth SMTP", detail: "Workspace/365 for password-reset emails from noreply@" + STAFF_EMAIL_DOMAIN, owner: "IT", href: "/email-security" },
  { title: "Optional: Resend API key", detail: "Only if you want invite emails from the app", owner: "IT", href: "/email-security" },
  {
    title: "Deploy edge functions",
    detail: "From repo: supabase login && supabase link --project-ref sfziuvxfeyfhkzmcxpou && bash scripts/deploy-edge-functions.sh",
    owner: "Dev",
  },
];

const DATA: Item[] = [
  { title: "Organization & branches", detail: "Hospital name, KRA, branches", href: "/organization", owner: "HR" },
  { title: "Departments, positions, grades", detail: "Org chart foundations", href: "/departments", owner: "HR" },
  { title: "Staff directory complete", detail: "Invite / bulk upload with @" + STAFF_EMAIL_DOMAIN, href: "/invite", owner: "HR" },
  { title: "Staff compliance data", detail: "KRA, salary, bank, NSSF, SHIF for every active employee", href: "/staff/compliance", owner: "HR / Finance" },
  { title: "Shift templates & holidays", detail: "Attendance engine expectations", href: "/attendance/shift-templates", owner: "HR" },
  { title: "Statutory rates verified", detail: "PAYE / NSSF / SHIF / Housing + OT multiplier", href: "/payroll/settings", owner: "Finance" },
];

const FIRST_PAY: Item[] = [
  { title: "Import biometric month", detail: "Then recompute daily attendance", href: "/attendance/import", owner: "HR" },
  { title: "Approve / reject OT", detail: "Clear pending OT before lock", href: "/attendance/overtime", owner: "Heads / HR" },
  { title: "Resolve blocker exceptions", detail: "Open exceptions queue", href: "/attendance/exceptions", owner: "Heads / HR" },
  { title: "Create payroll period & lock", detail: "System blocks lock if OT pending", href: "/payroll", owner: "HR" },
  { title: "Calculate → HR review → Finance approve", detail: "SoD enforced", href: "/payroll", owner: "HR / Finance" },
  { title: "Export bank + statutory CSVs", detail: "PAYE, NSSF, SHIF, Housing", href: "/payroll", owner: "Finance" },
  { title: "Staff download PDF payslips", detail: "My Payslips", href: "/my-payslips", owner: "Staff" },
];

const SECURITY: Item[] = [
  { title: "Go-live credentials / password reset", detail: "Force first login password change", href: "/go-live-credentials", owner: "SUPER_ADMIN" },
  { title: "Admin MFA enrolled", detail: "ADMIN / SUPER_ADMIN / FINANCE_ADMIN", owner: "Admins" },
  { title: "No public signup", detail: "Invite / bulk / go-live only — already in app", owner: "Done" },
];

function Section({ icon: Icon, title, items }: { icon: any; title: string; items: Item[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Icon className="h-5 w-5" /> {title}
        </CardTitle>
        <CardDescription>Work top to bottom. Links open the right screen.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.map((item, i) => (
          <div key={item.title} className="flex gap-3 border rounded-lg p-3">
            <Circle className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm">{i + 1}. {item.title}</div>
              <div className="text-xs text-muted-foreground mt-1">{item.detail}</div>
              <div className="flex flex-wrap gap-2 mt-2 items-center">
                <Badge variant="outline">{item.owner}</Badge>
                {item.href && (
                  <Button asChild size="sm" variant="ghost" className="h-7 px-2">
                    <Link to={item.href}>Open</Link>
                  </Button>
                )}
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export default function GoLiveChecklist() {
  const { isSuperAdmin, hasRole } = useRole();
  if (!isSuperAdmin && !hasRole("ADMIN") && !hasRole("FINANCE_ADMIN")) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Rocket className="h-8 w-8 text-primary" /> Go-Live Checklist
        </h1>
        <p className="text-muted-foreground">
          Everything left for a safe first payroll at Jalaram Hospital (@{STAFF_EMAIL_DOMAIN}).
        </p>
      </div>

      <Alert>
        <Database className="h-4 w-4" />
        <AlertTitle>Do this first (must_change_password)</AlertTitle>
        <AlertDescription className="space-y-2 text-sm mt-2">
          <p>
            Open{" "}
            <a
              className="underline font-medium"
              href="https://supabase.com/dashboard/project/sfziuvxfeyfhkzmcxpou/sql/new"
              target="_blank"
              rel="noreferrer"
            >
              Supabase SQL Editor
            </a>
            , paste the full contents of <code className="text-xs">scripts/supabase-go-live.sql</code> from this repo, click{" "}
            <strong>Run</strong>. Until that succeeds, Go-Live Credentials will warn that the column is missing.
          </p>
          <p className="text-muted-foreground">
            Built in the app already: domain lock, invite-only auth, force password change UI, admin MFA soft gate,
            approved-OT payroll, PDF payslips, exports, reports.
          </p>
        </AlertDescription>
      </Alert>

      <Section icon={Database} title="Deploy (once)" items={DEPLOY} />
      <Section icon={Users} title="Master data" items={DATA} />
      <Section icon={Clock} title="First pay run" items={FIRST_PAY} />
      <Section icon={Shield} title="Security" items={SECURITY} />
      <Section icon={Calculator} title="Finance reference" items={[
        { title: "Reports Hub", detail: "OT, absenteeism, licenses, payroll dumps", href: "/reports", owner: "HR / Finance" },
        { title: "Email & Security notes", detail: "SMTP / Resend optional path", href: "/email-security", owner: "IT" },
      ]} />
    </div>
  );
}
