#!/usr/bin/env bash
# Production-safe additive schema repair for Contabo go-live.
# Creates public.* HR schema on a database that only has hr.* platform tables.
# Preserves hr.app_credentials, hr.refresh_tokens, hr.audit_events, hr.tenants.
#
# NEVER run with FRESH_DB=1 or on a database that already has full Supabase data
# unless you know what you are doing.
#
# On VPS:
#   cd /opt/jalaramhr
#   bash ops/backup-postgres.sh
#   USE_PRODUCTION_COMPOSE=1 bash scripts/db/apply-production-schema.sh
#   ADMIN_EMAIL=admin@humasync.solutions NEW_PASSWORD='...' bash scripts/db/ensure-superadmin.sh
#   bash scripts/deploy-contabo.sh

set -euo pipefail
cd "$(dirname "$0")/../.."

if [[ -f .env ]]; then set -a; source .env; set +a; fi

if [[ "${FRESH_DB:-}" == "1" || "${ALLOW_DESTRUCTIVE:-}" == "1" ]]; then
  echo "ERROR: Refusing to run with FRESH_DB=1 or ALLOW_DESTRUCTIVE=1." >&2
  exit 1
fi

export USE_PRODUCTION_COMPOSE=1
COMPOSE=(docker compose -f docker-compose.yml -f docker-compose.production.yml)

POSTGRES_USER="${POSTGRES_USER:-jalaramhr}"
POSTGRES_DB="${POSTGRES_DB:-jalaramhr}"
CONTAINER="$("${COMPOSE[@]}" ps -q postgres 2>/dev/null || true)"

if [[ -z "$CONTAINER" ]]; then
  echo "Postgres is not running. Start the stack first:" >&2
  echo "  USE_PRODUCTION_COMPOSE=1 bash scripts/deploy-contabo.sh" >&2
  exit 1
fi

psql_exec() {
  docker exec -i "$CONTAINER" psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" "$@"
}

psql_file() {
  local label="$1"
  local path="$2"
  echo "→ $label"
  psql_exec < "$path"
  psql_exec -c "INSERT INTO hr.schema_migrations (filename) VALUES ('$label') ON CONFLICT DO NOTHING;"
}

migration_applied() {
  local name="$1"
  psql_exec -tAc "SELECT 1 FROM hr.schema_migrations WHERE filename = '$name' LIMIT 1" 2>/dev/null | grep -q 1
}

should_skip_migration() {
  local base
  base="$(basename "$1")"
  local skip
  for skip in "${SKIP_MIGRATIONS[@]}"; do
    [[ "$base" == "$skip" ]] && return 0
  done
  return 1
}

# Replaced foundation + demo/auth + overlap + Supabase-only RPCs
SKIP_MIGRATIONS=(
  "20260118142252_0ec35749-dc69-443a-9b97-d7bed6e20741.sql"
  "20260616073521_952be292-c325-4e18-92b8-46abc9f08f75.sql"
  "20260617095031_4ba7d1c0-d468-414a-a003-de8c347a4e01.sql"
  "20260621204006_e5c72280-2cf0-40f2-819b-83ffdd0bd016.sql"
  "20260724140000_admin_account_rpcs.sql"
  "20260713140252_3d7dae4f-ff3e-462a-ba8e-8d7f37d3de3f.sql"
  "20260713140346_169f8956-5a6f-4bf5-a25b-084b3e1b30b1.sql"
  "20260713140456_f6626434-ebad-48a9-860d-0aa5e9de1e67.sql"
  "20260717065219_945844fe-dc31-43d0-9825-586fcbd9c0cb.sql"
)

echo "=========================================="
echo "  PRODUCTION SCHEMA REPAIR (additive)"
echo "  Database: $POSTGRES_DB @ container $CONTAINER"
echo "=========================================="
echo ""
echo "This will CREATE public HR tables. hr.* data is preserved."
echo "Take a backup first: bash ops/backup-postgres.sh"
echo ""

if [[ "${CONFIRM_PRODUCTION_SCHEMA:-}" != "yes" ]]; then
  echo "To proceed, run:"
  echo "  CONFIRM_PRODUCTION_SCHEMA=yes USE_PRODUCTION_COMPOSE=1 bash scripts/db/apply-production-schema.sh"
  exit 0
fi

echo "Waiting for Postgres..."
for i in $(seq 1 30); do
  if docker exec "$CONTAINER" pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB" >/dev/null 2>&1; then
    break
  fi
  [[ "$i" -eq 30 ]] && { echo "Postgres not ready"; exit 1; }
  sleep 2
done

echo "→ hr.schema_migrations tracking table"
psql_exec <<'SQL'
CREATE TABLE IF NOT EXISTS hr.schema_migrations (
  filename text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);
SQL

BOOTSTRAP=(
  "scripts/db/00-auth-minimal.sql"
  "scripts/db/00-storage-schema.sql"
  "scripts/db/01-hr-platform.sql"
)

for f in "${BOOTSTRAP[@]}"; do
  label="$(basename "$f")"
  if migration_applied "$label"; then
    echo "→ SKIP $label (already applied)"
  else
    psql_file "$label" "$f"
  fi
done

HAS_PROFILES="$(psql_exec -tAc "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='profiles')" | tr -d '[:space:]')"
if [[ "$HAS_PROFILES" == "t" ]]; then
  echo "→ SKIP 03-production-public-foundation.sql (public.profiles already exists)"
else
  if migration_applied "03-production-public-foundation.sql"; then
    echo "→ SKIP 03-production-public-foundation.sql (tracked)"
  else
    psql_file "03-production-public-foundation.sql" "scripts/db/03-production-public-foundation.sql"
  fi
fi

for f in $(ls supabase/migrations/*.sql | sort); do
  base="$(basename "$f")"
  if should_skip_migration "$f"; then
    echo "→ SKIP $base (production skip list)"
    continue
  fi
  if migration_applied "$base"; then
    echo "→ SKIP $base (already applied)"
    continue
  fi
  echo "→ $f"
  psql_exec < "$f"
  psql_exec -c "INSERT INTO hr.schema_migrations (filename) VALUES ('$base') ON CONFLICT DO NOTHING;"
done

label="02-selfhost-compat.sql"
if migration_applied "$label"; then
  echo "→ SKIP $label (already applied)"
else
  psql_file "$label" "scripts/db/02-selfhost-compat.sql"
fi

echo ""
echo "==> Schema summary"
psql_exec -c "
SELECT 'hr.app_credentials' AS tbl, count(*)::text AS rows FROM hr.app_credentials
UNION ALL SELECT 'public.profiles', count(*)::text FROM public.profiles
UNION ALL SELECT 'public.departments', count(*)::text FROM public.departments
UNION ALL SELECT 'hr.schema_migrations', count(*)::text FROM hr.schema_migrations;
"

echo ""
echo "=========================================="
echo "  SCHEMA REPAIR COMPLETE"
echo ""
echo "  Next (on VPS):"
echo "    ADMIN_EMAIL=admin@humasync.solutions NEW_PASSWORD='YourPassword' \\"
echo "      bash scripts/db/ensure-superadmin.sh"
echo "    bash scripts/deploy-contabo.sh"
echo ""
echo "  Then log in at https://hr.humasync.solutions"
echo "  Create departments in Organization → Departments"
echo "  Invite staff with @jalaram.co.ke (default pwd ChangeMe123!)"
echo "=========================================="
