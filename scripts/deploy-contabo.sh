#!/usr/bin/env bash
# Jalaram HR — Contabo / VPS production deploy (one command)
set -euo pipefail
cd "$(dirname "$0")/.."

COMPOSE=(docker compose -f docker-compose.yml -f docker-compose.prod.yml)

if [[ ! -f .env ]]; then
  if [[ -f .env.production.example ]]; then
    cp .env.production.example .env
    echo "Created .env from .env.production.example"
    echo "Edit .env (passwords, PUBLIC_URL, SUPER_ADMIN_PASSWORD) then run again."
    exit 1
  fi
  cp .env.example .env
  echo "Created .env — edit secrets and PUBLIC_URL, then run again."
  exit 1
fi

set -a && source .env && set +a

BASE_PORT="${NGINX_HOST_PORT:-8081}"
PUBLIC="${PUBLIC_URL:-${FRONTEND_ORIGIN:-http://127.0.0.1:${BASE_PORT}}}"

echo "==> Production preflight..."
bash ops/prod-preflight.sh

if [[ "${FRESH_DB:-}" == "1" ]]; then
  echo "==> FRESH_DB=1 — wiping database volume..."
  "${COMPOSE[@]}" down -v
fi

echo "==> Building and starting production stack..."
"${COMPOSE[@]}" up -d --build

echo "==> Waiting for Postgres..."
for i in $(seq 1 60); do
  if "${COMPOSE[@]}" exec -T postgres pg_isready -U "${POSTGRES_USER:-jalaramhr}" >/dev/null 2>&1; then
    break
  fi
  sleep 2
done

user_count="$("${COMPOSE[@]}" exec -T postgres psql -U "${POSTGRES_USER:-jalaramhr}" -d "${POSTGRES_DB:-jalaramhr}" -tAc "SELECT count(*) FROM auth.users;" 2>/dev/null | tr -d '[:space:]' || echo 0)"

if [[ "${FRESH_DB:-}" == "1" || "$user_count" == "0" ]]; then
  echo "==> Applying migrations + seeding super admin..."
  bash scripts/db/apply-migrations.sh
  CONTAINER="$("${COMPOSE[@]}" ps -q postgres)"
  export ADMIN_EMAIL="${SUPER_ADMIN_EMAIL:-admin@jalaram.co.ke}"
  export ADMIN_PASSWORD="${SUPER_ADMIN_PASSWORD:-JalaramAdmin2026!}"
  export ADMIN_NAME="${SUPER_ADMIN_NAME:-Super Admin}"
  export STAFF_ID="${SUPER_ADMIN_STAFF_ID:-SA-001}"
  envsubst '${ADMIN_EMAIL} ${ADMIN_PASSWORD} ${ADMIN_NAME} ${STAFF_ID}' \
    < scripts/db/seed-superadmin.sql \
    | docker exec -i "$CONTAINER" psql -v ON_ERROR_STOP=1 -U "${POSTGRES_USER:-jalaramhr}" -d "${POSTGRES_DB:-jalaramhr}"
elif [[ -f data/supabase-export.sql ]]; then
  echo "==> Importing data/supabase-export.sql..."
  bash scripts/db/import-from-supabase.sh data/supabase-export.sql
else
  echo "==> Database has users — skipping fresh seed."
fi

echo "==> Smoke test..."
sleep 8
BASE_URL="http://127.0.0.1:${BASE_PORT}" \
EMAIL="${SUPER_ADMIN_EMAIL:-admin@jalaram.co.ke}" \
PASSWORD="${SUPER_ADMIN_PASSWORD:-JalaramAdmin2026!}" \
bash ops/smoke-test.sh

echo ""
echo "=========================================="
echo "  JALARAM HR — PRODUCTION READY"
echo "  Internal: http://127.0.0.1:${BASE_PORT}"
echo "  Public:   ${PUBLIC}"
echo "  Admin:    ${SUPER_ADMIN_EMAIL:-admin@jalaram.co.ke}"
echo ""
echo "  Next: point DNS + TLS (see docs/contabo-deployment-guide.md)"
echo "  Backup: bash ops/backup-postgres.sh"
echo "=========================================="
