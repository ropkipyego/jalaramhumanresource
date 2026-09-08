#!/usr/bin/env bash
# Jalaram HR — safe production deploy (Contabo). Preserves Postgres volume and data.
set -euo pipefail
cd "$(dirname "$0")/.."

COMPOSE=(docker compose -f docker-compose.yml -f docker-compose.production.yml)

if [[ -f .env ]]; then set -a; source .env; set +a; fi

export USE_PRODUCTION_COMPOSE=1

if [[ "${FRESH_DB:-}" == "1" ]]; then
  echo "ERROR: FRESH_DB=1 is blocked on production deploy." >&2
  echo "It wipes the Postgres volume and runs destructive seed SQL." >&2
  echo "For local/dev only use: FRESH_DB=1 bash scripts/go-live.sh" >&2
  exit 1
fi

BASE_PORT="${NGINX_HOST_PORT:-8081}"
PUBLIC="${PUBLIC_URL:-${FRONTEND_ORIGIN:-http://127.0.0.1:${BASE_PORT}}}"

echo "==> Production preflight..."
bash ops/prod-preflight.sh

echo "==> Building and starting production stack (volume preserved)..."
"${COMPOSE[@]}" up -d --build

echo "==> Waiting for health..."
sleep 10

if curl -fsS "http://127.0.0.1:${BASE_PORT}/api/v1/health" >/dev/null 2>&1; then
  echo "OK: API health"
else
  echo "WARN: health check failed — inspect: ${COMPOSE[*]} logs backend" >&2
fi

echo ""
echo "=========================================="
echo "  JALARAM HR — DEPLOY COMPLETE"
echo "  Internal: http://127.0.0.1:${BASE_PORT}"
echo "  Public:   ${PUBLIC}"
echo ""
echo "  Password reset (safe, one user):"
echo "    ADMIN_EMAIL=... NEW_PASSWORD=... bash scripts/db/reset-admin-password.sh"
echo ""
echo "  NEVER run: FRESH_DB=1, fresh-install.sh, seed-superadmin.sql"
echo "  Backup: bash ops/backup-postgres.sh"
echo "=========================================="
