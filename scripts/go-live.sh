#!/usr/bin/env bash
# Jalaram HR — one command go-live (Docker)
set -euo pipefail
cd "$(dirname "$0")/.."

if [[ ! -f .env ]]; then
  cp .env.example .env
  echo "Created .env — set POSTGRES_PASSWORD and JWT_ACCESS_SECRET, then run again."
  exit 1
fi
set -a && source .env && set +a

echo "==> Building and starting containers..."
docker compose up -d --build

echo "==> Waiting for Postgres..."
for i in $(seq 1 30); do
  if docker compose exec -T postgres pg_isready -U "${POSTGRES_USER:-jalaramhr}" >/dev/null 2>&1; then
    break
  fi
  sleep 2
done

if [[ "${FRESH_DB:-}" == "1" ]]; then
  bash scripts/db/fresh-install.sh
  exit 0
fi

if [[ -f data/supabase-export.sql ]]; then
  echo "==> Importing data/supabase-export.sql (keeps your live data)..."
  bash scripts/db/import-from-supabase.sh data/supabase-export.sql
elif [[ -n "${SUPABASE_DB_URL:-}" ]]; then
  echo "==> Exporting from Supabase and importing..."
  bash scripts/db/export-from-supabase.sh
else
  echo "==> No dump found — applying SQL migrations (fresh database)..."
  bash scripts/db/apply-migrations.sh
fi

echo ""
echo "=========================================="
echo "  LIVE: http://localhost:8080"
echo "  API:  http://localhost:8080/api/v1/health"
echo "=========================================="
echo ""
echo "To import your Supabase data instead:"
echo "  pg_dump ... -f data/supabase-export.sql"
echo "  bash scripts/go-live.sh"
