#!/usr/bin/env bash
# Safely reset ONE user's password on an EXISTING database (production-safe).
# Updates hr.app_credentials only — does NOT delete users, roles, or volumes.
#
# Usage on VPS:
#   cd /opt/jalaramhr
#   ADMIN_EMAIL=admin@humasync.solutions NEW_PASSWORD='YourNewSecurePassword' \
#     bash scripts/db/reset-admin-password.sh
#
# NEVER commit NEW_PASSWORD to git.

set -euo pipefail
cd "$(dirname "$0")/../.."

if [[ -f .env ]]; then set -a; source .env; set +a; fi

ADMIN_EMAIL="${ADMIN_EMAIL:-}"
NEW_PASSWORD="${NEW_PASSWORD:-}"

if [[ -z "$ADMIN_EMAIL" ]]; then
  echo "Set ADMIN_EMAIL (e.g. admin@humasync.solutions)" >&2
  exit 1
fi
if [[ -z "$NEW_PASSWORD" ]]; then
  echo "Set NEW_PASSWORD in the environment (min 8 chars). Do not pass on the command line in shell history." >&2
  exit 1
fi
if [[ ${#NEW_PASSWORD} -lt 8 ]]; then
  echo "NEW_PASSWORD must be at least 8 characters." >&2
  exit 1
fi

COMPOSE=(docker compose -f docker-compose.yml)
if [[ "${USE_PRODUCTION_COMPOSE:-}" == "1" ]]; then
  COMPOSE+=(-f docker-compose.production.yml)
fi

if [[ "${FRESH_DB:-}" == "1" || "${ALLOW_DESTRUCTIVE:-}" == "1" ]]; then
  echo "Refusing to run: unset FRESH_DB and ALLOW_DESTRUCTIVE before password reset." >&2
  exit 1
fi

BACKEND="$("${COMPOSE[@]}" ps -q backend 2>/dev/null || true)"
if [[ -z "$BACKEND" ]]; then
  echo "Backend container is not running. Start the stack first:" >&2
  echo "  bash scripts/deploy-contabo.sh" >&2
  exit 1
fi

"${COMPOSE[@]}" exec -T backend \
  env ADMIN_EMAIL="$ADMIN_EMAIL" NEW_PASSWORD="$NEW_PASSWORD" \
  node scripts/reset-password.mjs

echo "Done. Test login at your HR URL (do not log passwords)."
