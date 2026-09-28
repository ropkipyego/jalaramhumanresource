#!/usr/bin/env bash
# Apply post-go-live SQL patches (04 + 05). Safe to re-run.
set -euo pipefail
cd "$(dirname "$0")/../.."
if [[ -f .env ]]; then set -a; source .env; set +a; fi
export USE_PRODUCTION_COMPOSE=1
COMPOSE=(docker compose -f docker-compose.yml -f docker-compose.production.yml)
CONTAINER="$("${COMPOSE[@]}" ps -q postgres)"
[[ -n "$CONTAINER" ]] || { echo "Postgres not running"; exit 1; }
PSQL=(docker exec -i "$CONTAINER" psql -v ON_ERROR_STOP=1 -U "${POSTGRES_USER:-jalaramhr}" -d "${POSTGRES_DB:-jalaramhr}")
for f in scripts/db/04-live-hotfix.sql scripts/db/05-reception-housekeeping-shifts.sql; do
  echo "→ $f"
  "${PSQL[@]}" < "$f"
done
echo "OK. Restart PostgREST: docker compose -f docker-compose.yml -f docker-compose.production.yml up -d --force-recreate postgrest"
echo "Then: bash scripts/deploy-contabo.sh"
