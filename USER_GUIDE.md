# Jalaram HR — User Login & Testing Guide

_Last updated: July 2026_

Welcome. This guide walks every staff member through logging in, updating their own profile, and using the modules relevant to their role. Keep it handy while we run the pilot.

---

## 1. Getting your account

1. HR sends you an **invitation email** from `no-reply@jalaramhumanresource.lovable.app`.
2. Click the **"Accept invitation"** link — it opens the app and asks you to set a password.
3. On first sign-in you'll land on the **Onboarding form**. Fill in the missing personal details (ID number, KRA PIN, next of kin, bank, phone). This is your file; keep it accurate.
4. After onboarding you're taken to the **Dashboard**.

If the invitation link expires (older than 24 h), ask HR to re-send it from **Staff → Invite Staff**.

### Signing in later

Go to <https://jalaramhumanresource.lovable.app> → **Sign In** → enter your email + password.
Forgot your password? Use **Forgot password** on the sign-in page — a reset link is emailed to you.

---

## 2. Your roles

| Role            | What you can do                                                                        |
|-----------------|----------------------------------------------------------------------------------------|
| **STAFF**       | View & update own profile, own rota, own attendance, submit leave / swap requests.     |
| **HEAD**        | Everything STAFF + manage rotas, approve leave, review attendance for own department.  |
| **ADMIN (HR)**  | Everything HEAD + all departments, invitations, biometric imports, payroll assembly.   |
| **SUPER_ADMIN** | Everything ADMIN + statutory settings, role assignments, payroll finalisation.         |

Your role is shown in the top-right menu next to your name.

---

## 3. Everyone — the daily workflow

### 3.1 My Profile (`Profile` in the sidebar)
Update personal contact info, next-of-kin, bank details, uploaded documents (ID, KRA PIN card, academic certs). Fields that affect payroll (salary, staff ID, employment type) are read-only — contact HR for changes.

### 3.2 My Rota (`My Rota`)
Shows your published shifts for the current and coming weeks. Codes:
- **D** = Day shift · **N** = Night shift · **OFF** = Rest day · **PH** = Public Holiday worked
Specific start/end times per department are shown on hover.

### 3.3 My Attendance (`My Attendance`)
Every punch (biometric or web) rolls up here as a daily record. If you spot a wrong day, click **Raise exception** and add a note — your Head/HR reviews it.
**Web Clock** buttons let you clock in/out from a browser if you're away from the biometric.

### 3.4 My Leave (`Leave → My Leave`)
- **New Request** → choose type (annual / sick / maternity / compassionate / study / unpaid), pick dates, add reason. Attach a document if required (sick note).
- Your balance is shown at the top. You start with **21 annual days** each calendar year.
- You'll get a notification when your Head or HR approves/rejects.

### 3.5 My Payslips (`My Payslips`)
Payslips appear here once HR finalises the month. Download PDF or print.

### 3.6 Notifications 🔔
The bell in the top bar lists rota publications, leave decisions, announcements. Enable **push notifications** (toggle in your profile) to be alerted on your phone.

---

## 4. Department Heads (HEAD)

### 4.1 Department Rota (`Rota → Department Rota`)
- Weekly grid — drag or click cells to assign shifts.
- **Publish** locks the week and notifies your team.
- Or upload an Excel matrix (see § 5.2) if you already keep one.

### 4.2 Shift Swap Requests (`Rota → Shift Swaps`)
Approve or decline swaps proposed between two staff in your department.

### 4.3 Leave Approvals (`Leave → Approvals`)
Review pending requests from your department. Approving deducts balance automatically.

### 4.4 Attendance Exceptions (`Attendance → Exceptions`)
See flagged days (late arrivals, missed punches, cross-midnight shifts) and approve / correct.

---

## 5. HR / Admin

### 5.1 Biometric Import (`Attendance → Biometric Import`)

**Primary format — do not change it.** Export from your ZKTeco device:
`Attendance → Reports → Attendance Record Report → Export to Excel`

The file looks like:
```
Attendance Record Report
Att. Time    2026-06-01 ~ 2026-06-30                          Tabulation …
MON TUE WED …
1   2   3  …
ID:   19    Name:  VALENTINE   Executive Dept.
      08:13 18:04    07:25 18:27    …
ID:   3     Name:  WILLIAM     Company
09:11 18:29 …
```

Steps:
1. **Set each staff member's `Biometric Enroll ID`** on their profile (matches the "ID:" number in the file). Do this once.
2. Open **Biometric Import** → upload the .xlsx.
3. The parser extracts the date range, splits concatenated punches (`08:1318:04` → 08:13 + 18:04), and alternates IN/OUT.
4. Preview shows matched staff + a warnings panel for unmatched enroll IDs.
5. Click **Import & Compute** — punches are stored and daily attendance is recomputed.

### 5.2 Rota Upload (`Rota → Upload from Excel`)

Two layouts are auto-detected:

**A. Cumulative Rota matrix** (the format Chefs / Housekeeping / Pharmacy / Radiology / Lab already use):
```
                       DAYS  SUN MON TUE WED THUR FRI SAT SUN MON …
                      DATES    1   2   3   4    5   6   7   8   9  …
                      NAMES
RISPER                          N   N   N   O    O   O   D   D   D  …
ELIJAH                          D   O   O   D    D   D   O   O   O  …
```
Accepted codes: `D`, `N`, `OFF`, `PH`, plus `6AM`, `8AM`, `7AM`, `9AM` (mapped to D), `NIGHT`, `PM` (mapped to N), `O`, `REST`, `LEAVE` (mapped to OFF), `D/N` (double shift → counted as D with a warning).

**B. Simple template** — download it from the same page; one column per day.

Pick the department and month **before** uploading; the month selector defines the year for the DATES row.

**Shift times per department** (defaults — change per department in **Attendance → Shift Templates**):
| Dept              | D (Day)       | N (Night)     | 6AM shift     | 8AM shift     |
|-------------------|---------------|---------------|---------------|---------------|
| Reception         | 08:00 – 18:00 | 18:00 – 06:00 | —             | —             |
| Housekeeping      | 08:00 – 18:00 | 18:00 – 06:00 | 06:00 – 14:00 | 08:00 – 16:00 |
| Chefs             | 06:00 – 15:00 | 15:00 – 22:00 | —             | —             |
| Radiographers     | 08:00 – 18:00 | 18:00 – 08:00 | —             | —             |
| Pharmacy          | 08:00 – 17:00 | 17:00 – 08:00 | —             | —             |
| Lab               | 08:00 – 18:00 | 18:00 – 08:00 | —             | —             |

Each Head should confirm their department's times under **Shift Templates** on first login.

### 5.3 Payroll Period (`Payroll → Period`)
Workflow (segregation of duties):
1. **Draft** — HR creates the month.
2. **Attendance Locked** — HR closes attendance for the month.
3. **Calculated** — Admin runs `Calculate Payroll` (uses statutory rates).
4. **HR Reviewed** — HR signs off.
5. **Finance Approved** — Finance Admin approves.
6. **Locked** — Super Admin finalises → payslips visible to staff.

### 5.4 Statutory Settings (SUPER_ADMIN only)
PAYE bands, NSSF Tier I/II, SHIF, Housing Levy, Personal Relief — all editable in **Payroll → Statutory Settings**. Changes are audit-logged.

---

## 6. Troubleshooting

| Symptom                                          | Fix                                                                       |
|--------------------------------------------------|---------------------------------------------------------------------------|
| "Enroll ID X not mapped to a staff profile"     | Set that number in the staff's profile → *Biometric Enroll ID* field.     |
| Rota upload skips a person                       | Their name must match a profile in that department (case-insensitive).    |
| Leave request stuck at "pending"                 | Head hasn't approved — ping them; HR can also approve on their behalf.    |
| Payslip missing                                  | Period is not yet LOCKED — ask HR/Finance for status.                     |
| Push notifications not arriving                  | Profile → toggle push off & on; grant browser permission.                 |
| Forgot password / locked out                     | Use *Forgot password* on sign-in. If the reset mail doesn't arrive, ask HR to re-invite. |

---

## 7. Support

- **HR desk:** hr@jalaramhospital.co.ke
- **System issues:** report to the Super Admin (they can view Audit Logs and Compliance Dashboard).

_Thank you for helping us test — flag anything unexpected so we can fix it before go-live._
