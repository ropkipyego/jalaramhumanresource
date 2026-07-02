# Jalaram HR — Rota & Leave Management

A medical-grade staff rota and leave management platform built on Lovable Cloud.

**Live:** https://jalaramhumanresource.lovable.app
**Lovable project:** https://lovable.dev/projects/e3c3c974-5669-4563-8a44-1bea945fe9bd

---

## Roles

| Role | What they can do |
| --- | --- |
| **STAFF** | View their own rota & payslips, request leave, enable push notifications. |
| **HEAD** | Everything STAFF can do + manage rotas, approve leave, view directory for departments they lead. |
| **ADMIN** | Everything HEAD can do, across **every department** — browse all rotas, search any staff member, invite users, bulk-upload staff, upload monthly rotas, open Payroll & Staff Compliance. |
| **FINANCE_ADMIN** | Read all payroll data, approve payroll runs (Phase 2), export bank files (Phase 2). Cannot manage rotas or users. |
| **SUPER_ADMIN** | Full ADMIN rights + departments, rules, user management, statutory rate editing, and final payroll LOCK. |

Role assignments live in `public.user_roles` and are checked via the `has_role` / `has_any_role` security-definer functions. RLS on `rota_weeks` and `rota_assignments` already allows ADMIN/SUPER_ADMIN to read & write any department.

---

## Payroll (Phase 1 — foundation)

Kenya-compliant HR + Payroll skeleton, engine ships in Phase 2.

**What's live now (Phase 1):**
- Employee compliance fields on `profiles`: `national_id`, `kra_pin` (unique), `nssf_number`, `shif_number`, `designation`, `employment_type` (PERMANENT/CONTRACT/LOCUM/INTERN), `date_joined`, `contract_end_date`, `basic_salary`, `hr_status`, `practicing_license_no`, `license_expiry_date`, next of kin.
- New `FINANCE_ADMIN` role.
- Versioned `statutory_rates` seeded with 2024/2025 Kenya defaults: PAYE bands (Finance Act 2023), personal relief KES 2,400, NSSF Tier I & II, SHIF 2.75%, Housing Levy 1.5%. Editable by SUPER_ADMIN only, every change audited.
- `payroll_periods` with full workflow: `DRAFT → ATTENDANCE_LOCKED → CALCULATED → HR_REVIEWED → FINANCE_APPROVED → LOCKED`.
- Segregation of duties enforced in SQL trigger `enforce_payroll_sod`: HR reviewer cannot also approve as Finance; only FINANCE_ADMIN can approve; only SUPER_ADMIN can LOCK; once LOCKED the period is immutable.
- Append-only `payroll_audit` log for every payroll change, salary edit, statutory rate change and role assignment (update/delete blocked by trigger).
- Pages: `/payroll`, `/payroll/:id`, `/payroll/settings`, `/staff/compliance`.

**Coming in Phase 2:**
- Calculation engine (PAYE/NSSF/SHIF/Housing Levy), shift/overtime allowances derived from published rotas.
- Payslip PDF generation, bank export CSV, statutory reports (KRA P10, NSSF, SHIF).
- Clock In/Out module (optional).

**Prep before Phase 2 go-live:**
1. Assign FINANCE_ADMIN to your finance person via Staff Directory.
2. Fill KRA PIN + basic salary for every staff at `/staff/compliance` — employees missing either are excluded from payroll runs.
3. Review seeded statutory rates at `/payroll/settings` with your Finance team.

---

---

## Admin: cross-department visibility & search

- **My Rota** — when signed in as ADMIN/SUPER_ADMIN, the page shows a department selector listing **every active department**, plus a staff search box (name or staff ID) on the "All" tabs.
- **Department Rota** (edit grid) — admins can pick any department to edit.
- **Upload Rota** — admins can pick any department for the destination.
- All of the above is powered by the shared `useManageableDepartments` hook (`src/hooks/useManageableDepartments.ts`).

---

## Rota uploads — Monthly or Weekly

`/rota-upload` now ships with a **Monthly ↔ Weekly toggle**.

- **Monthly mode (default)** — generates a template with one column per day of the chosen month. On save we auto-split the data into the underlying `rota_weeks` (Monday-anchored) and create/update each week individually.
- **Weekly mode** — single 7-day template, same behaviour as before.
- Both modes accept the codes `D`, `N`, `OFF`, `PH` (aliases: `Day`, `Night`, `Rest`/`O`, `Holiday`/`Hol`).
- Already-published weeks are skipped on "Save as Draft" but overwritten on "Save & Publish".

---

## Bulk staff onboarding

`/invite/bulk` accepts an Excel with columns: **Staff ID, Full Name, Email, Role, Department**.

- Missing/blank emails get an auto-generated `<staffid>@jalaramhr.local` placeholder so the user can still sign in.
- New department names are auto-created.
- Duplicate Staff IDs or emails are skipped and listed in the downloadable report (the only place the generated password appears — download it immediately).

---

## Notifications

- **In-app bell** (`src/components/notifications/NotificationBell.tsx`) — backed by the `notifications` table and DB triggers (`notify_leave_status_change`, `notify_rota_published`).
- **Web Push / PWA** (`src/components/notifications/PushToggle.tsx` + `public/sw.js`) — users opt in from the Dashboard; subscriptions are stored in `push_subscriptions` and pushed via the `send-push` edge function using VAPID keys.

---

## Security checklist (recommended next steps)

The DB is locked down with RLS, security-definer helpers, and `service_role`-only writes for sensitive flows. Before going fully live, consider:

1. **Force-rotate the auto-generated bulk passwords on first login** — add an `must_change_password` flag on `profiles` and gate the dashboard until it's cleared. Right now the generated password lives only in the downloaded report, but a forced rotation removes the residual risk entirely.
2. **MFA / TOTP for ADMIN and SUPER_ADMIN** — enable Supabase Auth's MFA factor and require it for elevated roles.
3. **Disable the `@jalaramhr.local` placeholder login** once every staff member has a real email — those placeholder addresses can't receive password resets.
4. **Session timeout** — shorten the JWT TTL for ADMIN sessions (Auth → Sessions).
5. **Audit log review** — `audit_logs` records every privileged change via `public.log_audit`. Schedule a weekly export.
6. **Push secret rotation** — VAPID keys are stored as Supabase secrets; rotate annually.
7. **PII minimisation** — `profiles` exposes `email` and `staff_id`. The current RLS limits directory reads to authenticated users; consider a `profiles_public` view that omits `email` if the directory is ever opened to broader roles.
8. **Rate-limit the bulk-create edge function** — add a per-admin throttle to prevent accidental thousand-row uploads from overwhelming Auth.

---

## Tech stack

Vite · React 18 · TypeScript · Tailwind CSS · shadcn/ui · Lovable Cloud (Supabase: Postgres + Auth + Edge Functions + Storage).

## Local development

```sh
npm install
npm run dev
```
