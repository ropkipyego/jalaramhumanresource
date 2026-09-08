# Production schema repair (go-live blocker fix)

If login fails with `relation "public.profiles" does not exist`, production only has `hr.*` tables and never received the HR schema migrations.

**Do not** manually upload CSV users or departments — the app needs the full `public.*` schema (rota, leave, payroll, attendance, RLS, etc.).

---

## What this does

| Preserved | Created |
|-----------|---------|
| `hr.app_credentials` (password hashes) | `public.profiles`, `public.user_roles` |
| `hr.refresh_tokens` | `public.departments`, rota, leave, payroll… |
| `hr.audit_events` | PostgREST helpers (`auth.uid()`) |
| `hr.tenants` | Migration tracking in `hr.schema_migrations` |

Skipped on purpose (unsafe or wrong for production auth):

- Test user seed (`20260616073521`)
- Auth backfill trigger (`20260617095031`)
- Supabase Auth RPCs (`20260724140000`)
- Push notifications table with auth FK (`20260621204006`)
- Duplicate overlap migrations (handled by `02-selfhost-compat.sql`)

---

## One-time repair on Contabo VPS

```bash
cd /opt/jalaramhr
git pull

# 1. Backup first (mandatory)
bash ops/backup-postgres.sh

# 2. Ensure stack is up
USE_PRODUCTION_COMPOSE=1 bash scripts/deploy-contabo.sh

# 3. Apply public HR schema (additive — preserves hr.*)
CONFIRM_PRODUCTION_SCHEMA=yes USE_PRODUCTION_COMPOSE=1 \
  bash scripts/db/apply-production-schema.sh

# 4. Create super admin profile + password (links to hr.app_credentials)
USE_PRODUCTION_COMPOSE=1 ADMIN_EMAIL=admin@humasync.solutions NEW_PASSWORD='YourSecurePassword' \
  bash scripts/db/ensure-superadmin.sh

# 5. Redeploy app (pick up latest code)
bash scripts/deploy-contabo.sh
```

Verify:

```bash
curl -fsS http://127.0.0.1:8081/api/v1/health
docker exec $(docker compose -f docker-compose.yml -f docker-compose.production.yml ps -q postgres) \
  psql -U jalaramhr -d jalaramhr -c "SELECT count(*) FROM public.profiles;"
```

Log in at **https://hr.humasync.solutions** with `admin@humasync.solutions`.

---

## After schema repair — go live workflow

1. **Organization** → set hospital name, KRA, etc.
2. **Departments** → create wards/units (do not CSV-upload; use the UI)
3. **Invite Staff** or **Bulk Upload** → `@jalaram.co.ke`, default password `ChangeMe123!`
4. Staff first login → forced password change → complete profile + documents
5. **Rota** → upload / publish
6. **Payroll** → statutory settings already seeded by migrations

---

## If something fails mid-migration

- Check `hr.schema_migrations` for last applied file
- Restore from backup if needed — **never** run `FRESH_DB=1` or `fresh-install.sh`
- Fix the failing migration, then re-run `apply-production-schema.sh` (skips completed files)

---

## Re-running safely

The script is idempotent via `hr.schema_migrations`. Already-applied files are skipped. Safe to run again after `git pull` adds new migrations.
