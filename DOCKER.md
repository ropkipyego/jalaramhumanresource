# Self-hosted Jalaram HR (Docker)

Run everything on your own server — **PostgreSQL**, **NestJS API**, **PostgREST** (keeps the React app talking to your existing tables), **Redis**, **MinIO**, **Nginx**.

Pattern matches [Afya-Sasa](../Afya-Sasa) on your Desktop: `backend/` + `frontend/` + `docker-compose.yml`.

## Architecture

```
Browser → Nginx :8080
            ├── /           → React (frontend/)
            ├── /api/v1/    → NestJS auth, audit, notifications
            └── /rest/v1/   → PostgREST → same Postgres (profiles, rota, payroll…)
```

**Login:** NestJS validates passwords in `auth.users` (from Supabase dump or fresh seed).  
**Data:** All `public.*` tables (rota, attendance, payroll, profiles, user_roles…).

---

## Quick start

### 1. Copy environment file

```bash
cp .env.example .env
# Edit passwords and JWT_ACCESS_SECRET
```

### 2. Start stack

```bash
docker compose up -d --build
```

Open **http://localhost:8080**

### 3. Load your existing database

Export from Supabase (Dashboard → Database → backup, or `pg_dump`):

```bash
pg_dump "postgresql://postgres:YOUR_PASSWORD@db.sfziuvxfeyfhkzmcxpou.supabase.co:5432/postgres" \
  --schema=public --schema=auth --no-owner --no-acl -f supabase-export.sql

bash scripts/db/import-from-supabase.sh supabase-export.sql
```

Sign in with the **same email/password** staff already use.

### Fresh database (one SUPER_ADMIN, no Supabase data)

Wipes the Postgres volume, applies all migrations, and creates **one** super admin.

```bash
cp .env.example .env
# Set POSTGRES_PASSWORD, JWT_ACCESS_SECRET, and optionally:
# SUPER_ADMIN_EMAIL, SUPER_ADMIN_PASSWORD, SUPER_ADMIN_NAME, SUPER_ADMIN_STAFF_ID

bash scripts/db/fresh-install.sh
# or: FRESH_DB=1 bash scripts/go-live.sh
```

Default login after fresh install:

| Field | Default |
|-------|---------|
| Email | `admin@jalaram.co.ke` |
| Password | `JalaramAdmin2026!` |

Change `SUPER_ADMIN_*` in `.env` before running if you want different credentials.

### Fresh schema only (no user seed)

```bash
docker compose up -d postgres
bash scripts/db/apply-migrations.sh
docker compose up -d --build
```

Then seed manually:

```bash
export ADMIN_EMAIL='admin@jalaram.co.ke'
export ADMIN_PASSWORD='YourSecurePassword'
export ADMIN_NAME='Super Admin'
export STAFF_ID='SA-001'
envsubst '${ADMIN_EMAIL} ${ADMIN_PASSWORD} ${ADMIN_NAME} ${STAFF_ID}' \
  < scripts/db/seed-superadmin.sql \
  | docker exec -i $(docker compose ps -q postgres) psql -U jalaramhr -d jalaramhr
```

---

## Co-host with Afya-Sasa (same server)

Afya-Sasa uses port **8080**. Run HR on **8081** with non-conflicting DB/Redis/MinIO ports:

```bash
# .env on production server
NGINX_HOST_PORT=8081
POSTGRES_HOST_PORT=5434
REDIS_HOST_PORT=6381
MINIO_API_HOST_PORT=9002
MINIO_CONSOLE_HOST_PORT=9003
S3_PUBLIC_ENDPOINT=https://hr.yourdomain.com/minio
VITE_SUPABASE_URL=https://hr.yourdomain.com

docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

Point your host nginx/Certbot at `hr.yourdomain.com → 127.0.0.1:8081`.

---

## Test rota + overtime + payroll

```bash
bash scripts/test-hr-modules.sh
```

This runs shift-code unit tests, seeds a demo nurse with published rota + OT punches, and prints attendance/payroll lines.

Demo nurse login: `nurse.demo@jalaram.co.ke` / `DemoNurse2026!`

---

## Local development (without Docker)

```bash
# Terminal 1 — infrastructure
docker compose up -d postgres redis minio postgrest

# Terminal 2 — API
cd backend && npm install && npm run start:dev

# Terminal 3 — UI
cd frontend && npm install && npm run dev
```

Frontend dev: http://localhost:8080 (vite port 8080 in vite.config)  
Set `frontend/.env`:

```
VITE_API_BASE_URL=http://localhost:3000/api/v1
VITE_SUPABASE_URL=http://localhost:8080
VITE_SUPABASE_PUBLISHABLE_KEY=local-anon-key
VITE_USE_API_AUTH=true
```

For local dev, run nginx or point `VITE_SUPABASE_URL` to postgrest directly — simplest is full `docker compose up`.

---

## What's included (minimal)

| Module | Purpose |
|--------|---------|
| **NestJS auth** | Login, JWT, refresh tokens, `/auth/me` |
| **RBAC** | Maps STAFF/HEAD/ADMIN/FINANCE_ADMIN/SUPER_ADMIN → permissions |
| **Audit** | Writes to `audit_logs` or `hr.audit_events` |
| **Tenancy** | Single tenant `jalaram` (header `x-tenant` optional) |
| **Notifications API** | Lists `public.notifications` for logged-in user |
| **PostgREST** | Existing React pages keep using Supabase client → `/rest/v1` |
| **MinIO** | Private bucket for future document storage |

Not included (trimmed on purpose): patients, OPD, lab, recruitment modules from Afya-Sasa.

---

## Ports

| Service | Host port (env var) |
|---------|-----------|
| App (nginx) | **8080** (`NGINX_HOST_PORT`) |
| NestJS API | 3000 |
| Postgres | 5433 (`POSTGRES_HOST_PORT`) |
| Redis | 6380 (`REDIS_HOST_PORT`) |
| MinIO API | 9000 (`MINIO_API_HOST_PORT`) |
| MinIO console | 9001 (`MINIO_CONSOLE_HOST_PORT`) |

---

## Production

1. Set strong secrets in `.env`
2. **Contabo VPS:** follow **[docs/contabo-deployment-guide.md](docs/contabo-deployment-guide.md)** — one command: `FRESH_DB=1 bash scripts/deploy-contabo.sh`
3. Put nginx behind HTTPS (host nginx + Certbot — config in `infra/nginx-host-hr.conf.example`)
4. Schedule backups: `bash ops/backup-postgres.sh` (cron daily)

---

## Troubleshooting

**Login fails after import** — dump must include `auth` schema + `auth.users` with encrypted passwords.

**Blank data pages** — check browser network: `/rest/v1/` should return 200 with JWT from login.

**PostgREST errors** — ensure `JWT_ACCESS_SECRET` matches in `.env` for both `backend` and `postgrest` services.
