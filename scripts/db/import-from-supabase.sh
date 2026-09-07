#!/usr/bin/env bash
# Restore a Supabase/pg_dump into the local Docker Postgres (keeps your HR data).
#
# Usage:
#   bash scripts/db/import-from-supabase.sh /path/to/dump.sql
#
# Or export live from Supabase first:
#   pg_dump "postgresql://postgres:PASSWORD@db.PROJECT_REF.supabase.co:5432/postgres" \
#     --schema=public --schema=auth --no-owner --no-acl -f supabase-export.sql
#   bash scripts/db/import-from-supabase.sh supabase-export.sql
set -euo pipefail
cd "$(dirname "$0")/../.."

DUMP="${1:-}"
if [[ -z "$DUMP" || ! -f "$DUMP" ]]; then
  echo "Usage: bash scripts/db/import-from-supabase.sh /path/to/dump.sql"
  exit 1
fi

if [[ -f .env ]]; then set -a; source .env; set +a; fi

POSTGRES_USER="${POSTGRES_USER:-jalaramhr}"
POSTGRES_DB="${POSTGRES_DB:-jalaramhr}"
CONTAINER="${POSTGRES_CONTAINER:-$(docker compose ps -q postgres)}"

if [[ -z "$CONTAINER" ]]; then
  echo "Start postgres first: docker compose up -d postgres"
  exit 1
fi

echo "→ Applying HR platform schema..."
docker exec -i "$CONTAINER" psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" < scripts/db/01-hr-platform.sql

echo "→ Importing dump (this may take a few minutes)..."
docker exec -i "$CONTAINER" psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" < "$DUMP"

echo "Done. Open http://localhost:8080 and sign in with your existing staff credentials."
