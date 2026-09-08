# Local development (offline first)

Run the **full stack on your laptop** with no internet required after Docker images are pulled once.

When everything works locally, follow **[go-live-humasync.md](go-live-humasync.md)** for Contabo production.

---

## What runs locally

| Service | URL (default) |
|---------|----------------|
| **HR app** | http://localhost:8080 |
| **API health** | http://localhost:8080/api/v1/health |
| **PostgREST** | http://localhost:8080/rest/v1/ |
| **MinIO (via nginx)** | http://localhost:8080/minio/ |
| Postgres (host) | `localhost:5433` |

Everything is self-hosted: NestJS auth, PostgreSQL, MinIO, Redis — **no Supabase cloud, no Lovable**.

---

## Step 1 — Prerequisites

- Docker + Docker Compose
- Git clone of this repo
- **No** production `.env` secrets on your laptop (use local passwords only)

---

## Step 2 — Environment file

```bash
cd jalaramhumanresource
cp .env.example .env
```

Edit `.env` — minimum changes:

```env
POSTGRES_PASSWORD=choose-a-local-password
JWT_ACCESS_SECRET=choose-a-long-random-string-min-32-chars
MINIO_ROOT_PASSWORD=choose-a-local-minio-password

# Super admin login (local)
SUPER_ADMIN_EMAIL=admin@humasync.solutions
SUPER_ADMIN_PASSWORD=LocalAdmin2026!

# Staff invite domain
STAFF_EMAIL_DOMAIN=jalaram.co.ke
VITE_STAFF_EMAIL_DOMAIN=jalaram.co.ke
S3_BUCKET=employee-documents
```

---

## Step 3 — Start offline

**Option A — recommended (start or seed if empty):**

```bash
bash scripts/local-dev.sh
```

**Option B — completely fresh database (wipes local volume only):**

```bash
bash scripts/local-dev.sh fresh
```

**Option C — manual:**

```bash
docker compose up -d --build
bash scripts/db/apply-migrations.sh
ADMIN_EMAIL=admin@humasync.solutions NEW_PASSWORD='LocalAdmin2026!' \
  bash scripts/db/ensure-superadmin.sh
docker compose run --rm minio-init
```

---

## Step 4 — Verify locally

```bash
curl -fsS http://localhost:8080/api/v1/health
```

Open http://localhost:8080 and sign in:

| | |
|--|--|
| **Email** | `admin@humasync.solutions` |
| **Password** | from `SUPER_ADMIN_PASSWORD` in `.env` |

Then check:

1. **Dashboard** loads
2. **Invite Staff** — email must be `@jalaram.co.ke`
3. **My Profile** — upload a test document (MinIO)
4. **Rota upload** — upload a template Excel file
5. **Attendance import** — upload biometric Excel (parser test)

Run module smoke test:

```bash
bash scripts/test-hr-modules.sh
```

---

## Step 5 — Local commands

```bash
# Stop stack
bash scripts/local-dev.sh down

# View backend logs
bash scripts/local-dev.sh logs backend

# Reset super-admin password only
ADMIN_EMAIL=admin@humasync.solutions NEW_PASSWORD='NewLocalPass123' \
  bash scripts/db/reset-admin-password.sh

# Rebuild after code changes
docker compose up -d --build
```

---

## Email domains (local = same as production)

| Account | Domain | Example |
|---------|--------|---------|
| Super admin | `@humasync.solutions` | `admin@humasync.solutions` |
| Staff | `@jalaram.co.ke` | `nurse001@jalaram.co.ke` |

---

## Local vs production

| | Local | Production (Contabo) |
|--|-------|----------------------|
| URL | http://localhost:8080 | https://hr.humasync.solutions |
| Compose | `docker-compose.yml` | `+ docker-compose.production.yml` |
| Deploy script | `scripts/local-dev.sh` | `scripts/deploy-contabo.sh` |
| Fresh DB | `local-dev.sh fresh` ✅ | **NEVER** `FRESH_DB=1` ❌ |
| Seed super admin | `ensure-superadmin.sh` ✅ | `ensure-superadmin.sh` ✅ |
| Wipe volume | OK on laptop | **NEVER** on VPS |

---

## When local works → go live

1. Commit and push your tested changes to GitHub.
2. On VPS: `git pull && bash scripts/deploy-contabo.sh`
3. Create production super admin (if not already):

   ```bash
   ADMIN_EMAIL=admin@humasync.solutions NEW_PASSWORD='...' \
     bash scripts/db/ensure-superadmin.sh
   ```

4. Full production checklist: **[go-live-humasync.md](go-live-humasync.md)**
5. Safety rules: **[production-auth-and-safety.md](production-auth-and-safety.md)**

---

## Troubleshooting

**404 on `/auth`, `/dashboard`, or refresh** — fixed by `frontend/nginx.conf` (SPA fallback). Rebuild:

```bash
docker compose up -d --build frontend nginx
```

Use **http://localhost:8080** (not port 5173 unless you know why).

**Login fails** — confirm profile + credentials:

```bash
docker compose exec -T postgres psql -U jalaramhr -d jalaramhr -c "
SELECT p.email, array_agg(ur.role), (c.user_id IS NOT NULL) AS has_password
FROM public.profiles p
LEFT JOIN public.user_roles ur ON ur.user_id = p.id
LEFT JOIN hr.app_credentials c ON c.user_id = p.id
WHERE lower(p.email) = 'admin@humasync.solutions'
GROUP BY p.id, p.email, c.user_id;"
```

**Document upload fails** — run `docker compose run --rm minio-init` and confirm `S3_BUCKET=employee-documents` in `.env`

**Health check fails** — `docker compose logs backend postgres`
