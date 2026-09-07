#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [[ -f .env ]]; then set -a; source .env; set +a; fi

mkdir -p backups
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
output="${1:-backups/jalaramhr-${stamp}.sql.gz}"

docker compose -f docker-compose.yml -f docker-compose.prod.yml exec -T postgres \
  pg_dump -U "${POSTGRES_USER:-jalaramhr}" -d "${POSTGRES_DB:-jalaramhr}" --clean --if-exists \
  | gzip > "$output"

echo "Backup written to ${output}"
