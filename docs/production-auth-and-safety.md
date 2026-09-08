# Production authentication & database safety

**Live URL:** https://hr.humasync.solutions  
**Compose file:** `docker-compose.production.yml`  
**Super admin email (intended):** `admin@humasync.solutions`

---

## A. Current authentication architecture

| Layer | Table / store | Purpose |
|-------|----------------|---------|
| **Identity** | `public.profiles` | Staff record: email, name, staff_id, hr_status |
| **Password (production)** | `hr.app_credentials` | `password_hash` verified with **Node bcrypt** |
| **Roles** | `public.user_roles` | `app_role` enum incl. `SUPER_ADMIN` |
| **JWT login** | NestJS `AuthService` | Issues access + refresh tokens |
| **Refresh tokens** | `hr.refresh_tokens` | SHA-256 hash of refresh token |
| **Tenancy** | `hr.tenants` | Default tenant code `jalaram` |
| **Audit** | `hr.audit_events` | Login / failed login events |
| **PostgREST / UI data** | `public.*` | Rota, payroll, attendance (JWT from NestJS) |

### Login flow (production — no `auth` schema)

1. `POST /api/v1/auth/login` → `AuthService.login()`
2. If `auth` schema **missing** (production): `verifyAppCredentials()`
   - Join `public.profiles` + `hr.app_credentials`
   - `bcrypt.compare(password, password_hash)`
3. Load roles from `public.user_roles`
4. Sign JWT; insert `hr.refresh_tokens`
5. Frontend stores token; PostgREST calls use `Authorization: Bearer …`

### Super admin identification

- Email matches row in `public.profiles` (e.g. `admin@humasync.solutions`)
- Role `SUPER_ADMIN` in `public.user_roles`
- JWT includes `roles: ['SUPER_ADMIN']` and `permissions: ['*']`

---

## B. Repository vs production mismatch

| Item | Repository assumption | Production reality |
|------|----------------------|-------------------|
| `scripts/db/seed-superadmin.sql` | Deletes all users; uses `auth.users` | **Must never run on production** |
| `FRESH_DB=1` deploy | Wipes Docker volume | **Blocked in `deploy-contabo.sh`** |
| `apply-migrations.sh` | Creates `auth` schema | Production was built without `auth` |
| Staff invite (old) | Only `auth.users` | Fixed: uses `hr.app_credentials` when no `auth` |

Production uses the **hr + public** model described above.

---

## C. Safe production deploy (preserves volume)

```bash
cd /opt/jalaramhr
git pull
bash scripts/deploy-contabo.sh
```

This only runs `docker compose … up -d --build`. It does **not** migrate, seed, or wipe data.

---

## D. Safe super-admin password reset

**Only** updates `hr.app_credentials` for **one** email (must exist in `public.profiles`).

```bash
cd /opt/jalaramhr
ADMIN_EMAIL=admin@humasync.solutions NEW_PASSWORD='YourNewSecurePassword' \
  bash scripts/db/reset-admin-password.sh
```

Requirements:

- `NEW_PASSWORD` min 8 characters (set in env, never commit)
- Stack must be running (backend container)
- Refuses to run if `FRESH_DB=1`

Verify login in browser (do not echo password in logs).

---

## E. Commands you MUST NOT run on production

```bash
FRESH_DB=1 bash scripts/deploy-contabo.sh   # blocked — would wipe volume
bash scripts/db/fresh-install.sh
bash scripts/go-live.sh with FRESH_DB=1
psql < scripts/db/seed-superadmin.sql
docker compose down -v
```

---

## F. Email domains (dual setup)

| Account type | Email domain | Example |
|--------------|--------------|---------|
| **Super admin** | `@humasync.solutions` | `admin@humasync.solutions` |
| **Staff** | `@jalaram.co.ke` | `jane.doe@jalaram.co.ke` |

Production `.env`:

```env
SUPER_ADMIN_EMAIL=admin@humasync.solutions
STAFF_EMAIL_DOMAIN=jalaram.co.ke
VITE_STAFF_EMAIL_DOMAIN=jalaram.co.ke
VITE_SUPER_ADMIN_EMAIL=admin@humasync.solutions
```

Create super admin on existing DB:

```bash
ADMIN_EMAIL=admin@humasync.solutions NEW_PASSWORD='...' bash scripts/db/ensure-superadmin.sh
```

---

## G. File uploads / documents

- **Storage:** MinIO (S3-compatible) on your server
- **Bucket:** `employee-documents` (private)
- **Upload path:** NestJS `POST /api/v1/storage/upload` (multipart)
- **Download path:** NestJS `GET /api/v1/storage/download?path=...`
- **Delete path:** NestJS `DELETE /api/v1/storage/delete?path=...`
- **Metadata:** `public.employee_documents` table via PostgREST
- **No Supabase Storage API** — frontend uses `@/lib/storage.ts`, not `supabase.storage`

Ensure production `.env` includes:

```env
S3_BUCKET=employee-documents
```

**Working parsers (unit tests):**

- `frontend/src/lib/shiftCodeParse.ts` — rota Excel codes
- `frontend/src/lib/biometricParser.ts` — attendance import
- `frontend/src/lib/attendanceEngine.ts` — OT calculation client-side

Run locally: `bash scripts/test-hr-modules.sh`

---

## H. Backup before any change

```bash
bash ops/backup-postgres.sh
```
