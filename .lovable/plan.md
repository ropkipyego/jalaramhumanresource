
# Phase 1 — Payroll Foundation (Go-live safe)

Goal: lay the audit-safe skeleton for payroll **without** running money yet. Nothing in this phase can pay, deduct, or export bank files. Phase 2 turns the engine on.

## What ships now

### 1. Compliance fields on every employee
Extend `profiles` with payroll-critical identifiers. All optional at first so existing staff aren't blocked, but payroll runs in Phase 2 will refuse any employee missing `kra_pin`.

New columns on `profiles`:
- `national_id` (text)
- `kra_pin` (text, unique when set)
- `nssf_number` (text)
- `shif_number` (text)
- `practicing_license_no` (text)
- `license_expiry_date` (date)
- `designation` (text)
- `employment_type` (enum: PERMANENT, CONTRACT, LOCUM, INTERN)
- `date_joined` (date)
- `contract_end_date` (date)
- `basic_salary` (numeric(12,2))
- `hr_status` (enum: ACTIVE, SUSPENDED, ON_LEAVE, TERMINATED, default ACTIVE)
- `next_of_kin_name`, `next_of_kin_phone`, `address` (text)

Staff Directory gets a new "Compliance & Payroll" tab (ADMIN/SUPER_ADMIN/FINANCE_ADMIN only) to edit these.

### 2. New role: FINANCE_ADMIN
Add to `app_role` enum. Segregation of duties enforced in SQL:
- FINANCE_ADMIN can read all payroll data, approve payroll runs, export bank files.
- SUPER_ADMIN **cannot** approve a payroll run — checked in the approval RPC.
- Sidebar gets a "Finance" group visible only to FINANCE_ADMIN.

### 3. Statutory settings (editable by SUPER_ADMIN)
Seeded with 2025/2026 Kenya defaults. Versioned so historical payroll stays reproducible.

- `statutory_rates` — one active row per (`rate_type`, `effective_from`)
  - `rate_type`: PAYE_BAND, NSSF_TIER1, NSSF_TIER2, SHIF, HOUSING_LEVY, PERSONAL_RELIEF
  - `config` jsonb (bands array for PAYE, percentage + cap for others)
  - `effective_from`, `effective_to`
- `payroll_settings` — global toggles (standard shift hours, night allowance %, weekend %, holiday multiplier, overtime rate)

Seeded values:
- PAYE bands (2024/2025 Finance Act): 10% ≤24k, 25% ≤32,333, 30% ≤500k, 32.5% ≤800k, 35% >800k
- Personal relief: KES 2,400/month
- NSSF Tier I: 6% up to 8,000 (both employee + employer)
- NSSF Tier II: 6% on 8,001–72,000
- SHIF: 2.75% of gross, min KES 300
- Housing Levy: 1.5% of gross (employee) + 1.5% (employer)

A `/statutory-settings` page (SUPER_ADMIN only) lets you edit bands and adds a new `effective_from` row instead of mutating history.

### 4. Payroll skeleton (read-only)
Tables created, UI shows structure, but no calculations run yet.

- `payroll_periods` — month, year, status (DRAFT, ATTENDANCE_LOCKED, CALCULATED, HR_REVIEWED, FINANCE_APPROVED, LOCKED), locked_by, locked_at
- `payroll_runs` — one per employee per period; earnings/deductions/net_pay all nullable
- `payroll_line_items` — breakdown rows (BASIC, HOUSE_ALLOWANCE, NIGHT_ALLOWANCE, PAYE, NSSF, SHIF, HOUSING_LEVY, …), type EARNING or DEDUCTION
- `payroll_audit` — append-only log of every payroll state change with before/after JSON

New pages (all read-only in Phase 1):
- `/payroll` — list periods, "New Period" button (creates DRAFT only)
- `/payroll/:periodId` — period detail with employee list and status banner ("Engine not yet enabled — Phase 2")
- `/payroll/settings` — statutory rates viewer/editor (SUPER_ADMIN)

Sidebar additions:
- **Finance** group: Payroll, Statutory Settings, Bank Exports (disabled)
- Visible to ADMIN/SUPER_ADMIN/FINANCE_ADMIN with role-appropriate items.

### 5. Audit hardening
- Every write to `profiles.basic_salary`, `payroll_periods.status`, `statutory_rates`, and `user_roles` fires `log_audit` via trigger.
- `payroll_audit` rows are insert-only (RLS blocks update/delete for everyone incl. service_role via policy).

## What is explicitly NOT in Phase 1

- Calculation engine (PAYE/NSSF/SHIF math)
- Payslip generation / PDF
- Bank export CSV
- Clock-in module
- Attendance-to-payroll derivation
- Approval workflow buttons (present but disabled with "Phase 2" tooltip)

These come in Phase 2 once you've populated compliance fields for all staff and confirmed the statutory numbers.

## Technical details

**Migration order (single migration):**
1. Add columns/enums to `profiles` + `app_role`.
2. Create `statutory_rates`, `payroll_settings`, `payroll_periods`, `payroll_runs`, `payroll_line_items`, `payroll_audit`.
3. GRANTs on each (service_role always; authenticated where policies allow).
4. RLS enable + policies using `has_role()` and a new `has_any_role()` check for FINANCE_ADMIN.
5. Seed statutory_rates + payroll_settings defaults.
6. Segregation-of-duties trigger: reject `payroll_periods.status = 'FINANCE_APPROVED'` update unless `has_role(auth.uid(), 'FINANCE_ADMIN')` AND actor is NOT the same user who set status to `HR_REVIEWED`.

**Files touched:**
- `supabase/migrations/<new>.sql` (all schema + seed)
- `src/types/database.ts` — new types
- `src/hooks/useRole.ts` — add FINANCE_ADMIN, `isFinanceAdmin`
- `src/components/layout/AppSidebar.tsx` — Finance group
- `src/pages/Payroll.tsx` (new), `src/pages/PayrollPeriod.tsx` (new), `src/pages/StatutorySettings.tsx` (new)
- `src/pages/StaffDirectory.tsx` — Compliance & Payroll tab
- `src/App.tsx` — routes
- `README.md` + `Jalaram_HR_SOP.md` — Phase 1 payroll section

## After you approve

I run the migration, wire the UI, and you can immediately:
1. Assign FINANCE_ADMIN to your finance person.
2. Start filling KRA PIN / NSSF / SHIF / basic salary for staff (bulk upload template will be extended in the next turn if you want).
3. Review the seeded statutory rates and adjust if the finance team has different numbers.

Then we schedule Phase 2 (engine + approvals + payslips + bank export) once the data is clean.
