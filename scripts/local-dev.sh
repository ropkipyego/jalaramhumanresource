#!/usr/bin/env bash
# Start Jalaram HR locally (offline). Safe for your laptop — uses local Docker volumes only.
set -euo pipefail
cd "$(dirname "$0")/.."

if [[ ! -f .env ]]; then
  cp .env.example .env
  echo "Created .env from .env.example — review passwords, then run again."
  exit 1
fi
set -a && source .env && set +a

MODE="${1:-up}"

case "$MODE" in
  up)
    echo "==> Starting local stack (offline)..."
    docker compose up -d --build

    echo "==> Waiting for Postgres..."
    for i in $(seq 1 40); do
      if docker compose exec -T postgres pg_isready -U "${POSTGRES_USER:-jalaramhr}" >/dev/null 2>&1; then
        break
      fi
      sleep 2
    done

    PROFILE_COUNT="$(docker compose exec -T postgres psql -U "${POSTGRES_USER:-jalaramhr}" -d "${POSTGRES_DB:-jalaramhr}" -tAc \
      "SELECT count(*) FROM public.profiles" 2>/dev/null | tr -d '[:space:]' || echo 0)"

    if [[ "$PROFILE_COUNT" == "0" ]]; then
      echo "==> Empty database — applying migrations..."
      bash scripts/db/apply-migrations.sh
      echo "==> Creating super admin..."
      ADMIN_EMAIL="${SUPER_ADMIN_EMAIL:-admin@humasync.solutions}" \
        NEW_PASSWORD="${SUPER_ADMIN_PASSWORD:-LocalAdmin2026!}" \
        bash scripts/db/ensure-superadmin.sh
    else
      echo "==> Database has $PROFILE_COUNT profile(s) — skipping seed."
    fi

    docker compose run --rm minio-init 2>/dev/null || true

    sleep 5
    echo ""
    echo "=========================================="
    echo "  LOCAL HR (offline)"
    echo "  App:    http://localhost:${NGINX_HOST_PORT:-8080}"
    echo "  Health: http://localhost:${NGINX_HOST_PORT:-8080}/api/v1/health"
    echo ""
    echo "  Super admin: ${SUPER_ADMIN_EMAIL:-admin@humasync.solutions}"
    echo "  Password:    set in .env SUPER_ADMIN_PASSWORD (or run ensure-superadmin.sh)"
    echo "  Staff domain: @${STAFF_EMAIL_DOMAIN:-jalaram.co.ke}"
    echo ""
    echo "  Fresh wipe + reseed: bash scripts/local-dev.sh fresh"
    echo "  Stop:                bash scripts/local-dev.sh down"
    echo "=========================================="
    ;;

  fresh)
    echo "==> Wiping LOCAL database volume and reseeding..."
    FRESH_DB=1 bash scripts/db/fresh-install.sh
    docker compose run --rm minio-init 2>/dev/null || true
    ;;

  down)
    docker compose down
    ;;

  logs)
    docker compose logs -f "${2:-backend}"
    ;;

  *)
    echo "Usage: bash scripts/local-dev.sh [up|fresh|down|logs [service]]" >&2
    exit 1
    ;;
esac
