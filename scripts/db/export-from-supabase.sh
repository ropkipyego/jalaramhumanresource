#!/usr/bin/env bash
# Export from remote Supabase Postgres and import into local Docker.
set -euo pipefail
cd "$(dirname "$0")/../.."

if [[ -f .env ]]; then set -a; source .env; set +a; fi

if [[ -z "${SUPABASE_DB_URL:-}" ]]; then
  echo "Set SUPABASE_DB_URL in .env, e.g.:"
  echo 'SUPABASE_DB_URL=postgresql://postgres:YOUR_PASSWORD@db.sfziuvxfeyfhkzmcxpou.supabase.co:5432/postgres'
  exit 1
fi

mkdir -p data
DUMP="data/supabase-export.sql"
echo "→ Exporting to $DUMP ..."
pg_dump "$SUPABASE_DB_URL" --schema=public --schema=auth --no-owner --no-acl -f "$DUMP"
bash scripts/db/import-from-supabase.sh "$DUMP"
