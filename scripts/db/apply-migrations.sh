#!/usr/bin/env bash
# Apply all SQL migrations from supabase/migrations (fresh DB without Supabase dump).
set -euo pipefail
cd "$(dirname "$0")/../.."

if [[ -f .env ]]; then set -a; source .env; set +a; fi

POSTGRES_USER="${POSTGRES_USER:-jalaramhr}"
POSTGRES_DB="${POSTGRES_DB:-jalaramhr}"
CONTAINER="${POSTGRES_CONTAINER:-$(docker compose ps -q postgres)}"

# Overlap with org_foundation / attendance_engine / hrpms_pro_modules on empty DB.
SKIP_MIGRATIONS=(
  "20260713140252_3d7dae4f-ff3e-462a-ba8e-8d7f37d3de3f.sql"
  "20260713140346_169f8956-5a6f-4bf5-a25b-084b3e1b30b1.sql"
  "20260713140456_f6626434-ebad-48a9-860d-0aa5e9de1e67.sql"
  "20260717065219_945844fe-dc31-43d0-9825-586fcbd9c0cb.sql"
)
should_skip() {
  local base
  base="$(basename "$1")"
  local skip
  for skip in "${SKIP_MIGRATIONS[@]}"; do
    [[ "$base" == "$skip" ]] && return 0
  done
  return 1
}

if [[ -z "$CONTAINER" ]]; then
  echo "Start postgres first: docker compose up -d postgres"
  exit 1
fi

echo "Waiting for Postgres to accept connections..."
for i in $(seq 1 60); do
  if docker exec "$CONTAINER" pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB" >/dev/null 2>&1 \
    && docker exec "$CONTAINER" psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SELECT 1" >/dev/null 2>&1; then
    break
  fi
  if [[ "$i" -eq 60 ]]; then
    echo "Postgres did not become ready in time."
    exit 1
  fi
  sleep 2
done

echo "→ scripts/db/00-auth-schema.sql"
if [[ "${SKIP_AUTH_SCHEMA:-}" == "1" ]]; then
  echo "   SKIP (SKIP_AUTH_SCHEMA=1 — hr.app_credentials mode)"
else
  docker exec -i "$CONTAINER" psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" < scripts/db/00-auth-schema.sql
fi

echo "→ scripts/db/00-storage-schema.sql"
docker exec -i "$CONTAINER" psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" < scripts/db/00-storage-schema.sql

echo "→ scripts/db/01-hr-platform.sql"
docker exec -i "$CONTAINER" psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" < scripts/db/01-hr-platform.sql

for f in $(ls supabase/migrations/*.sql | sort); do
  if should_skip "$f"; then
    echo "→ SKIP $f (self-host overlap)"
    continue
  fi
  echo "→ $f"
  docker exec -i "$CONTAINER" psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" < "$f" || {
    echo "FAILED: $f"
    exit 1
  }
done

echo "→ scripts/db/02-selfhost-compat.sql"
docker exec -i "$CONTAINER" psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" < scripts/db/02-selfhost-compat.sql

echo "All migrations applied."
