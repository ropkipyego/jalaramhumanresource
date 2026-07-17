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

---

## Appendix A — Testing the system (Go-Live Checklist)

Use this order for pilot testing.

### 1. Super Admin bootstrap (one-time)
- Log in with the seeded Super Admin account.
- Go to **Organization Setup** → confirm hospital name, address, PIN, KRA branch.
- Go to **Statutory Settings** → confirm PAYE, NSSF, SHIF and Housing Levy rates match the current Finance Act.
- Go to **Departments** → create every department (Reception, Housekeeping, OPD, Wards, Lab, Pharmacy, Admin, etc.).
- Go to **Positions** and **Job Grades** → add the ones your hospital uses.

### 2. HR Admin loads staff
- **Staff → Invite Staff** or **Bulk Staff Upload** to create profiles.
- On each profile → **Employment** tab: assign Department, Position, Grade, Manager, employment type and date joined.
- On each profile → **Personal** tab: set the **Biometric Enroll ID** to the number that appears under `ID:` in your ZKTeco export. This is what makes attendance imports match.

### 3. Heads set up rotas
- **Rota → Department Rota** → pick department, pick week, add shifts (D, N, OFF, PH, L).
- Or **Rota → Upload Rota** to import the department cumulative rota (matrix format).
- Publish the week. Staff get a notification.

### 4. Attendance import
- Export from the ZKTeco device: **Attendance → Reports → Attendance Record Report → Excel**.
- **Attendance → Biometric Import** → upload the file.
- Any unmapped Enroll IDs appear in the **"Map unmapped Enroll IDs to staff"** panel with auto-suggested names. Confirm the picks and click **Save mapping** — the file re-matches automatically. Repeat until zero unmapped.
- Click **Import & Compute**.

### 5. Payroll dry-run
- **Payroll → Periods** → open the month → **Lock Attendance** → **Calculate**.
- Review any missing-data flags (basic salary, KRA PIN). Fix on the profile and recalculate.
- HR **Review** → Finance **Approve** → Super Admin **Lock**.

### 6. Offboarding
- Open the staff profile → **Offboard** button (red) → enter reason → confirm.
- The account is deactivated, department memberships removed, and every admin gets a notification.

---

## Appendix B — Self-hosting on Hetzner (production)

Lovable Cloud (your current hosting) is fine for the pilot. If you decide to run the whole stack on your own Hetzner server, here is a proven path.

> **Before you start**: Everything below assumes you own a domain (e.g. `hr.jalaram.co.ke`), a Hetzner Cloud account, and basic Linux comfort. Budget ~2 hours end-to-end.

### 1. Provision the server
- **Hetzner Cloud** → New Project → **Add Server**.
- Location: **Nuremberg / Falkenstein / Helsinki** (EU) or **Ashburn** (US) — pick the closest to Kenya (Helsinki gives good latency).
- Image: **Ubuntu 24.04 LTS**.
- Type: **CPX21** (3 vCPU / 4 GB RAM / 80 GB) is a comfortable start for < 200 staff. Upgrade to **CPX31** if you keep years of biometric history.
- Add your **SSH key**.
- Enable **Backups** (adds 20 % but critical for HR data).
- Note the public **IPv4** address.

### 2. Point your domain at the server
In your DNS provider add:
```
A    hr.jalaram.co.ke     -> <your Hetzner IP>
A    api.jalaram.co.ke    -> <your Hetzner IP>
```

### 3. First login and hardening
```bash
ssh root@<ip>
adduser hr && usermod -aG sudo hr
rsync --archive --chown=hr:hr ~/.ssh /home/hr
ufw allow OpenSSH && ufw allow http && ufw allow https && ufw enable
apt update && apt upgrade -y
apt install -y docker.io docker-compose-plugin git nginx certbot python3-certbot-nginx
systemctl enable --now docker
```

### 4. Install Supabase (self-hosted, holds all your data)
```bash
sudo -iu hr
git clone --depth 1 https://github.com/supabase/supabase
cd supabase/docker
cp .env.example .env
# Edit .env: set POSTGRES_PASSWORD, JWT_SECRET (openssl rand -hex 32),
#   SITE_URL=https://hr.jalaram.co.ke,
#   API_EXTERNAL_URL=https://api.jalaram.co.ke,
#   DASHBOARD_USERNAME / DASHBOARD_PASSWORD
docker compose pull
docker compose up -d
```

Wait 2–3 min, then check: `docker compose ps` — every service should be **healthy**.

### 5. Migrate the schema and data from Lovable Cloud
1. In Lovable: **Cloud → Advanced settings → Export data**. Wait for the email/notification, download the ZIP.
2. Copy to server: `scp export.zip hr@<ip>:/home/hr/`
3. On the server:
   ```bash
   unzip export.zip
   psql "postgresql://postgres:<pw>@localhost:5432/postgres" < schema.sql
   psql "postgresql://postgres:<pw>@localhost:5432/postgres" < data.sql
   ```
4. Copy the `supabase/migrations/` folder from this project to the server and run them in order (they're idempotent).

### 6. Build and deploy the frontend
On your laptop:
```bash
git clone <this repo>
cd <repo>
cp .env .env.production
# Edit .env.production:
#   VITE_SUPABASE_URL=https://api.jalaram.co.ke
#   VITE_SUPABASE_PUBLISHABLE_KEY=<the ANON key printed by supabase docker up>
#   VITE_SUPABASE_PROJECT_ID=self-hosted
bun install
bun run build
rsync -avz dist/ hr@<ip>:/var/www/hr/
```

### 7. Nginx + HTTPS
On the server, `/etc/nginx/sites-available/hr`:
```nginx
server {
  server_name hr.jalaram.co.ke;
  root /var/www/hr;
  index index.html;
  location / { try_files $uri /index.html; }
}
server {
  server_name api.jalaram.co.ke;
  location / {
    proxy_pass http://localhost:8000;   # Supabase Kong
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $remote_addr;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```
```bash
ln -s /etc/nginx/sites-available/hr /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
certbot --nginx -d hr.jalaram.co.ke -d api.jalaram.co.ke
```

### 8. Nightly backups
```bash
# /etc/cron.daily/hr-backup
#!/bin/bash
d=$(date +%F)
docker exec supabase-db pg_dump -U postgres postgres | gzip > /backups/db-$d.sql.gz
find /backups -name 'db-*.sql.gz' -mtime +30 -delete
```
Mirror `/backups` to Hetzner **Storage Box** or S3 with `rclone`.

### 9. Email (invitations & password resets)
Set these in Supabase Studio → Authentication → SMTP:
- Host: `smtp.resend.com` (or your provider)
- Port: `465` (SSL)
- User / Pass: your API credentials
- Sender: `no-reply@jalaram.co.ke`

### 10. Verify
- Visit `https://hr.jalaram.co.ke` — log in with your Super Admin.
- Invite one test staff, complete their onboarding, upload one biometric file, run one payroll dry-run.

Once green, decommission the Lovable Cloud project or keep it as a warm standby.

**Support**: if you get stuck at any step, capture the exact error and the step number and share with your engineer — the numbering above makes triage fast.
