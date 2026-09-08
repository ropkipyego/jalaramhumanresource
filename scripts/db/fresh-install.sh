#!/usr/bin/env bash
# Fresh database: drop volume, apply all migrations, seed ONE super admin.
# LOCAL/DEV ONLY — never run on production Contabo.
set -euo pipefail
cd "$(dirname "$0")/../.."

if [[ -f .env ]]; then set -a; source .env; set +a; fi

ADMIN_EMAIL="${SUPER_ADMIN_EMAIL:-admin@humasync.solutions}"
ADMIN_PASSWORD="${SUPER_ADMIN_PASSWORD:-JalaramAdmin2026!}"
ADMIN_NAME="${SUPER_ADMIN_NAME:-Super Admin}"
STAFF_ID="${SUPER_ADMIN_STAFF_ID:-SA-001}"

echo "==> Stopping stack and removing database volume..."
docker compose down -v

echo "==> Starting Postgres..."
docker compose up -d postgres redis minio
echo "==> Waiting for Postgres..."
for i in $(seq 1 40); do
  if docker compose exec -T postgres pg_isready -U "${POSTGRES_USER:-jalaramhr}" >/dev/null 2>&1; then
    break
  fi
  sleep 2
done

echo "==> Applying schema migrations..."
bash scripts/db/apply-migrations.sh

CONTAINER="$(docker compose ps -q postgres)"
export ADMIN_EMAIL="$ADMIN_EMAIL"
export ADMIN_NAME="$ADMIN_NAME"
export STAFF_ID="$STAFF_ID"

HAS_AUTH="$(docker exec "$CONTAINER" psql -U "${POSTGRES_USER:-jalaramhr}" -d "${POSTGRES_DB:-jalaramhr}" -tAc \
  "SELECT 1 FROM information_schema.schemata WHERE schema_name='auth' LIMIT 1" | tr -d '[:space:]')"

echo "==> Seeding super admin..."
if [[ "$HAS_AUTH" == "1" ]]; then
  export ADMIN_PASSWORD="$ADMIN_PASSWORD"
  envsubst '${ADMIN_EMAIL} ${ADMIN_PASSWORD} ${ADMIN_NAME} ${STAFF_ID}' \
    < scripts/db/seed-superadmin.sql \
    | docker exec -i "$CONTAINER" psql -v ON_ERROR_STOP=1 -U "${POSTGRES_USER:-jalaramhr}" -d "${POSTGRES_DB:-jalaramhr}"
  USE_HR_PASSWORD=0
else
  envsubst '${ADMIN_EMAIL} ${ADMIN_NAME} ${STAFF_ID}' \
    < scripts/db/seed-superadmin-hr.sql \
    | docker exec -i "$CONTAINER" psql -v ON_ERROR_STOP=1 -U "${POSTGRES_USER:-jalaramhr}" -d "${POSTGRES_DB:-jalaramhr}"
  USE_HR_PASSWORD=1
fi

echo "==> Starting full stack..."
docker compose up -d --build

echo "==> Setting bcrypt password via hr.app_credentials (matches production)..."
sleep 10
docker compose exec -T backend \
  env ADMIN_EMAIL="$ADMIN_EMAIL" NEW_PASSWORD="$ADMIN_PASSWORD" \
  node scripts/reset-password.mjs || echo "WARN: password script failed — check backend logs"

sleep 4
HEALTH="$(curl -s -o /dev/null -w '%{http_code}' http://localhost:${NGINX_HOST_PORT:-8080}/api/v1/health || echo fail)"
echo ""
echo "=========================================="
echo "  FRESH DATABASE READY (dev only)"
echo "  URL:      http://localhost:8080"
echo "  Email:    $ADMIN_EMAIL"
echo "  Health:   $HEALTH"
echo "=========================================="
