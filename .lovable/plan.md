
# Time & Attendance Module (TAMS)

This is a large module. I'll ship it in **three phases** so each phase is reviewable, testable, and doesn't destabilise Rota / Payroll. Nothing here is hardcoded — every threshold lives in the DB.

---

## Phase A — Foundations (schema, shift templates, holidays, settings, dashboard shell)

**DB (one migration):**
- `shift_templates` — name, code, department_id (nullable = global), start_time, end_time, crosses_midnight, expected_hours, grace_before, grace_after, min_ot_minutes, ot_round_minutes, meal_break_minutes, paid_break, is_night, is_weekend, is_holiday, is_active.
- `public_holidays` — date, name, scope (`NATIONAL|HOSPITAL|COUNTY|CUSTOM`), county, is_paid, notes.
- `attendance_settings` — singleton row: late_threshold_min, grace_min, min_ot_min, ot_round_min, max_daily_ot, max_monthly_ot, night_start, night_end, night_diff_pct, sat_working, sun_working, weekend_ot_pct, weekend_allow_pct, approval_levels, lock_after_payroll.
- `rota_assignments.shift_template_id` (nullable FK, additive — existing `shift_code` stays for backward compatibility). Migration to reference templates while keeping D/N/OFF/PH working.
- Full RLS + GRANTs following project conventions.

**Frontend:**
- New sidebar group **Time & Attendance** (STAFF sees Dashboard + own records only; HEAD sees dept scope; ADMIN/HR full; FINANCE read of approved).
- Pages (skeletons wired to real data where available):
  - `/attendance` Dashboard (KPIs + charts, recharts)
  - `/attendance/shift-templates` full CRUD
  - `/attendance/holidays` full CRUD
  - `/attendance/settings` (SUPER_ADMIN)

---

## Phase B — Biometric import + attendance engine + exceptions

**DB:**
- `biometric_imports` — file_name, uploaded_by, row_count, ok_count, rejected_count, status, log_jsonb.
- `biometric_punches` — import_id, employee_id (matched by staff_id/employee_number), punch_date, clock_in_ts, clock_out_ts, device_id, location, raw_row. Immutable (append-only trigger — never overwrite).
- `attendance_records` — employee_id, work_date, shift_template_id, scheduled_start_ts, scheduled_end_ts, actual_in_ts, actual_out_ts, worked_minutes, late_minutes, early_leave_minutes, overtime_minutes, status enum (Present, Late, Absent, On_Leave, Public_Holiday, Off_Duty, Half_Day, Weekend_Duty, Night_Duty, Suspended, Training, Official_Assignment), is_exception, exception_codes[], approval_status, approved_by, approved_at, notes.
- `attendance_exceptions` — record_id, code, severity, detected_at, resolved_at, resolved_by, resolution_notes.
- `attendance_corrections` — record_id, requested_by, requested_change jsonb, stage (`EMP→SUPERVISOR→HR→APPLIED`), decisions[], applied_at. Original punch preserved.
- SQL fn `recalc_attendance(period_start, period_end, dept_id?)`:
  1. Build expected schedule from published `rota_weeks` + `shift_templates` (uses full timestamps, correctly handles cross-midnight).
  2. Match against `biometric_punches` (nearest in-window, dedupe).
  3. Compute worked minutes, late, early, overtime (grace + rounding rule from settings).
  4. Cross-reference `leave_requests` and `public_holidays` → status.
  5. Detect exceptions (missing in, missing out, duplicate, very early, very late, multi-punch, invalid shift, overlapping, leave conflict, holiday conflict).
  6. Upsert `attendance_records`, insert exceptions.

**Frontend:**
- `/attendance/imports` — Excel upload (SheetJS, already in project), preview, validate, commit; import history + rejection report.
- `/attendance/records` — filterable grid (dept, employee, date range, status, exception only), inline drill-down.
- `/attendance/exceptions` — queue with resolve/approve.
- `/attendance/overtime` — OT list per employee/period with approve/reject.
- `/my-attendance` — employee self-view.

---

## Phase C — Approval workflow, reports, payroll bridge

**DB:**
- `attendance_periods` — month, dept scope (optional), status enum `OPEN → SUPERVISOR_REVIEWED → HEAD_APPROVED → HR_APPROVED → LOCKED`, timestamps + actor per step, SoD trigger (supervisor ≠ head ≠ HR approver where roles allow).
- Payroll bridge: rewrite `derive_attendance()` to read from **approved/locked** `attendance_records` instead of raw rota. Refuses to run for months with no LOCKED attendance period. Rota-only fallback stays behind a settings flag for backwards compat during rollout.

**Frontend:**
- `/attendance/periods` — workflow buttons per stage, gated by role, SoD enforced by trigger.
- `/attendance/reports` — Daily, Monthly, Late, Absentee, Dept, Employee History, Night, Weekend, Holiday, OT Summary, Exception Report. PDF (jsPDF) + Excel (SheetJS) export.
- Payroll UI shows attendance-period lock badge; blocks calc if unlocked.

---

## Cross-cutting

- **Security:** role matrix enforced via RLS + `useRole` gating. Every write hits `payroll_audit` (extended to `entity_type IN (attendance_record, attendance_correction, attendance_period, shift_template, holiday, settings)`).
- **Notifications:** exception raised → supervisor; correction stage change → next actor; period locked → finance.
- **No hardcoding:** every threshold read from `attendance_settings` / `shift_templates` at calc time.
- **Cross-midnight:** all comparisons in `timestamptz`, never `time`.
- **Idempotent recalc:** `recalc_attendance` is safe to re-run; regenerates records but preserves manual overrides flagged `is_manual_override`.
- **README + SOP** updated per phase.

---

## Suggested rollout

1. **Phase A now** (schema + templates + holidays + settings + dashboard shell + sidebar).
2. **Phase B next turn** (import + engine + exceptions + records UI).
3. **Phase C after** (approval workflow + reports + payroll bridge).

Reply **"Ship Phase A"** to start, or tell me to bundle A+B / all three (bigger single change, higher risk of a broken build mid-way).
