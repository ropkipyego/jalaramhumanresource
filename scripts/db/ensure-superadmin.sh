#!/usr/bin/env bash
# Create or update the SUPER_ADMIN profile on an EXISTING database (production-safe).
# Does NOT delete users, roles, or volumes.
#
# Default super admin: admin@humasync.solutions
# Staff accounts use STAFF_EMAIL_DOMAIN=jalaram.co.ke (invite / bulk upload).
#
# Usage on VPS:
#   cd /opt/jalaramhr
#   bash scripts/db/ensure-superadmin.sh
#
# With password (recommended first time):
#   ADMIN_EMAIL=admin@humasync.solutions NEW_PASSWORD='YourSecurePassword' \
#     bash scripts/db/ensure-superadmin.sh

set -euo pipefail
cd "$(dirname "$0")/../.."

if [[ -f .env ]]; then set -a; source .env; set +a; fi

ADMIN_EMAIL="${ADMIN_EMAIL:-${SUPER_ADMIN_EMAIL:-admin@humasync.solutions}}"
ADMIN_NAME="${ADMIN_NAME:-${SUPER_ADMIN_NAME:-Super Admin}}"
STAFF_ID="${STAFF_ID:-${SUPER_ADMIN_STAFF_ID:-SA-001}}"
NEW_PASSWORD="${NEW_PASSWORD:-}"

COMPOSE=(docker compose -f docker-compose.yml)
if [[ "${USE_PRODUCTION_COMPOSE:-}" == "1" ]]; then
  COMPOSE+=(-f docker-compose.production.yml)
fi

if [[ "${FRESH_DB:-}" == "1" || "${ALLOW_DESTRUCTIVE:-}" == "1" ]]; then
  echo "Refusing to run: unset FRESH_DB and ALLOW_DESTRUCTIVE." >&2
  exit 1
fi

POSTGRES="$("${COMPOSE[@]}" ps -q postgres 2>/dev/null || true)"
if [[ -z "$POSTGRES" ]]; then
  echo "Postgres container is not running. Start the stack first:" >&2
  echo "  bash scripts/deploy-contabo.sh" >&2
  exit 1
fi

echo "==> Ensuring SUPER_ADMIN profile: ${ADMIN_EMAIL}"
export ADMIN_EMAIL ADMIN_NAME STAFF_ID
envsubst '${ADMIN_EMAIL} ${ADMIN_NAME} ${STAFF_ID}' \
  < scripts/db/seed-superadmin-hr.sql \
  | docker exec -i "$POSTGRES" psql -v ON_ERROR_STOP=1 \
      -U "${POSTGRES_USER:-jalaramhr}" -d "${POSTGRES_DB:-jalaramhr}"

echo "==> Verifying profile + role..."
docker exec -i "$POSTGRES" psql -U "${POSTGRES_USER:-jalaramhr}" -d "${POSTGRES_DB:-jalaramhr}" -c "
SELECT p.email, p.staff_id, p.is_active, array_agg(ur.role) AS roles,
       (c.user_id IS NOT NULL) AS has_password
FROM public.profiles p
LEFT JOIN public.user_roles ur ON ur.user_id = p.id
LEFT JOIN hr.app_credentials c ON c.user_id = p.id
WHERE lower(p.email) = lower('${ADMIN_EMAIL}')
GROUP BY p.id, p.email, p.staff_id, p.is_active, c.user_id;
"

if [[ -n "$NEW_PASSWORD" ]]; then
  echo "==> Setting password via hr.app_credentials..."
  ADMIN_EMAIL="$ADMIN_EMAIL" NEW_PASSWORD="$NEW_PASSWORD" bash scripts/db/reset-admin-password.sh
elif [[ -z "$(docker exec "$POSTGRES" psql -U "${POSTGRES_USER:-jalaramhr}" -d "${POSTGRES_DB:-jalaramhr}" -tAc \
  "SELECT 1 FROM hr.app_credentials c JOIN public.profiles p ON p.id = c.user_id WHERE lower(p.email) = lower('${ADMIN_EMAIL}') LIMIT 1" | tr -d '[:space:]')" ]]; then
  echo ""
  echo "NOTE: No password set yet. Run:"
  echo "  ADMIN_EMAIL=${ADMIN_EMAIL} NEW_PASSWORD='...' bash scripts/db/reset-admin-password.sh"
fi

echo ""
echo "Done. Super admin login: ${ADMIN_EMAIL}"
echo "Staff invites use @${STAFF_EMAIL_DOMAIN:-jalaram.co.ke}"
