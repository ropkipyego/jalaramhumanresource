
# Plan — Staff ID fix, Self-Service Profile, Sidebar Categorisation, Phase 2 Payroll

Three things ship in this turn. Phase 2 is the big one so it's split into clear sub-steps.

---

## 1. Staff ID entered as-is (quick fix)

Right now the `handle_new_user` trigger and bulk upload replace missing/duplicate Staff IDs with `AUTO-xxxxx`. That's why some rows lost their real Staff ID.

Change:
- `handle_new_user`: only fall back to `AUTO-…` when metadata is empty. Never overwrite a provided Staff ID even if it collides — instead raise a clear error so the uploader sees it.
- `bulk-create-staff` edge function: stop rewriting the Staff ID. Pass it through verbatim, and if it already exists mark the row `skipped` with reason "Staff ID already exists" (already done — but confirm no silent rewrite).
- `create-staff-user` edge function: same guarantee.

Existing rows that were auto-renamed stay as-is (I won't touch historical data without you saying so). If you want me to bulk-rename them from a CSV, say the word.

---

## 2. Self-service profile ("My Profile")

Every logged-in user gets `/my-profile`. They can view and edit their **own** record:

Editable by the user:
- Phone, address, next-of-kin name & phone
- KRA PIN, NSSF number, SHIF number, National ID
- Practicing licence number + expiry
- Avatar (later — file storage), for now URL field

Read-only (admin-only):
- Staff ID, Email, Full name, Role, Departments
- Basic salary, employment_type, date_joined, contract_end_date, hr_status

RLS: `profiles` already lets a user update their own row; I'll tighten it so non-admin updates can't touch salary/role/status/staff_id/full_name via a `BEFORE UPDATE` trigger that resets those columns to `OLD.*` when `auth.uid() = id` and the user is not ADMIN/SUPER_ADMIN.

Sidebar: "My Profile" under a new **Me** group.

---

## 3. Sidebar categorisation

Regroup the sidebar so it flows top-down by daily use:

```
Me
 ├─ Dashboard
 ├─ My Profile
 ├─ My Rota
 └─ My Leave

Rotas                (HEAD/ADMIN/SUPER_ADMIN)
 ├─ Department Rota
 └─ Rota Upload

People               (ADMIN/SUPER_ADMIN)
 ├─ Staff Directory
 ├─ Staff Compliance
 ├─ Invite Staff
 ├─ Bulk Upload
 ├─ Departments
 └─ Leave Admin

Finance              (FINANCE_ADMIN + ADMIN/SUPER_ADMIN read)
 ├─ Payroll
 ├─ Statutory Settings
 └─ Bank Exports

System               (SUPER_ADMIN)
 └─ Audit Logs
```

No route changes — just grouping in `AppSidebar.tsx`.

---

## 4. Phase 2 — Payroll Engine (Kenya compliant)

Turns the Phase 1 skeleton into a working engine. Still gated behind FINANCE_ADMIN / SUPER_ADMIN.

### 4a. Attendance derivation (from Rota)
- New SQL function `derive_attendance(period_id)` — for each employee, walks published `rota_assignments` between `period_start` and `period_end`, counts:
  - `days_worked` (D + N)
  - `night_shifts` (N)
  - `public_holidays_worked` (PH)
  - `off_days` (OFF)
  - `absent_days` (no assignment & not on approved leave)
  - `leave_days` (from approved `leave_requests` overlapping the period, split paid vs unpaid by `leave_type`)
- Writes per-employee attendance summary into `payroll_runs.attendance_json`.

### 4b. Calculation engine (`calculate_payroll(period_id)`)
Runs once, when period moves DRAFT → CALCULATED. For every ACTIVE employee with `basic_salary` set:

1. **Earnings**
   - Basic = `basic_salary`
   - House allowance = if configured on employee (Phase 2.1 adds allowances table; for now optional column)
   - Night allowance = `night_shifts × (basic/30) × night_pct` (default 15%)
   - Public holiday allowance = `ph_worked × (basic/30) × holiday_multiplier` (default 200%)
   - Unpaid-leave deduction = `unpaid_days × (basic/30)`
   - Gross = sum of earnings

2. **Statutory deductions** (from active `statutory_rates`)
   - **NSSF**: Tier I 6% × min(pensionable, 8000), Tier II 6% × min(max(pensionable-8000, 0), 64000). Employee + employer legs both stored.
   - **SHIF**: max(2.75% × gross, 300)
   - **Housing Levy**: 1.5% × gross (employee) + 1.5% (employer)
   - **PAYE**: apply bands to `taxable = gross − NSSF_employee − SHIF − Housing_employee`, then subtract Personal Relief (2,400), floor at 0.
   - Insurance relief / mortgage relief: skipped Phase 2, add later.

3. **Net pay** = Gross − PAYE − NSSF_emp − SHIF − Housing_emp − Unpaid − other deductions.

4. **Write** `payroll_line_items` rows for every component (traceable audit) + update `payroll_runs` totals.

5. Refuses to run if any active employee is missing `kra_pin` OR `basic_salary` — returns a list so HR can fix first.

### 4c. Workflow buttons wired
On `/payroll/:periodId`:
- **Lock Attendance** (HR/ADMIN) — DRAFT → ATTENDANCE_LOCKED, runs `derive_attendance`.
- **Run Calculation** (HR/ADMIN) — ATTENDANCE_LOCKED → CALCULATED, runs `calculate_payroll`.
- **HR Review** (HR/ADMIN, not the same person as approver) — CALCULATED → HR_REVIEWED.
- **Finance Approve** (FINANCE_ADMIN only, SoD trigger already blocks HR reviewer) — HR_REVIEWED → FINANCE_APPROVED.
- **Finalise / Lock** (SUPER_ADMIN) — FINANCE_APPROVED → LOCKED (immutable).
- Any status roll-back allowed only from DRAFT/ATTENDANCE_LOCKED/CALCULATED by ADMIN.

### 4d. Payslip
- `/payroll/:periodId/payslip/:employeeId` — clean printable page (React + `window.print()`), employer header, employee block, earnings, deductions, employer contribs, net pay in words.
- Employees see their own past payslips at `/my-payslips` (only for `LOCKED` periods).

### 4e. Bank export
- `/payroll/:periodId/export` (FINANCE_ADMIN, period must be FINANCE_APPROVED or LOCKED):
  - CSV: Name, Bank, Branch, Account, Amount, Reference — one row per employee.
  - New fields on `profiles`: `bank_name`, `bank_branch`, `bank_account`. Editable in My Profile.
- Statutory returns (P10/NSSF/SHIF/Housing) exported as CSV per period.

### 4f. Audit
Already in place from Phase 1. Every calculation/approval/lock writes to `payroll_audit`.

---

## Technical notes

- New migration adds: `bank_name`, `bank_branch`, `bank_account`, `house_allowance` on profiles; `attendance_json` on `payroll_runs`; profile-protection trigger; three SQL functions (`derive_attendance`, `calculate_payroll`, `net_pay_in_words`).
- No changes to `auth.users`. Client edits go through Supabase directly (RLS + trigger).
- No calculations happen client-side — the engine is 100% SQL so it's reproducible and auditable.
- I'll test with one sample employee (you can seed) before you run a real period.

---

## Files touched

- `supabase/migrations/<new>.sql` — schema + functions + trigger
- `supabase/functions/bulk-create-staff/index.ts`, `create-staff-user/index.ts` — Staff ID passthrough
- `src/pages/MyProfile.tsx` (new), `MyPayslips.tsx` (new), `PayrollPayslip.tsx` (new), `PayrollBankExport.tsx` (new)
- `src/pages/PayrollPeriod.tsx` — workflow buttons, engine calls
- `src/components/layout/AppSidebar.tsx` — regroup
- `src/App.tsx` — new routes
- `README.md` + `Jalaram_HR_SOP.md` — Phase 2 sections + payslip/bank guide

---

Approve and I'll ship it in one pass.
