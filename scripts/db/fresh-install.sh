#!/usr/bin/env bash
# Fresh database: drop volume, apply all migrations, seed ONE super admin.
set -euo pipefail
cd "$(dirname "$0")/../.."

if [[ -f .env ]]; then set -a; source .env; set +a; fi

ADMIN_EMAIL="${SUPER_ADMIN_EMAIL:-admin@jalaram.co.ke}"
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

echo "==> Seeding single SUPER_ADMIN..."
CONTAINER="$(docker compose ps -q postgres)"
export ADMIN_EMAIL="$ADMIN_EMAIL"
export ADMIN_PASSWORD="$ADMIN_PASSWORD"
export ADMIN_NAME="$ADMIN_NAME"
export STAFF_ID="$STAFF_ID"
envsubst '${ADMIN_EMAIL} ${ADMIN_PASSWORD} ${ADMIN_NAME} ${STAFF_ID}' \
  < scripts/db/seed-superadmin.sql \
  | docker exec -i "$CONTAINER" psql -v ON_ERROR_STOP=1 -U "${POSTGRES_USER:-jalaramhr}" -d "${POSTGRES_DB:-jalaramhr}"

echo "==> Starting full stack..."
docker compose up -d --build

sleep 6
HEALTH="$(curl -s http://localhost:8080/api/v1/health || true)"
echo ""
echo "=========================================="
echo "  FRESH DATABASE READY"
echo "  URL:      http://localhost:8080"
echo "  Email:    $ADMIN_EMAIL"
echo "  Password: $ADMIN_PASSWORD"
echo "  Health:   $HEALTH"
echo "=========================================="
