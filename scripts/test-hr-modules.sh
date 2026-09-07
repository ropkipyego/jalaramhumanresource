#!/usr/bin/env bash
# Smoke test: rota parsing (unit tests) + overtime + payroll (SQL).
set -euo pipefail
cd "$(dirname "$0")/.."

if [[ -f .env ]]; then set -a; source .env; set +a; fi

POSTGRES_USER="${POSTGRES_USER:-jalaramhr}"
POSTGRES_DB="${POSTGRES_DB:-jalaramhr}"
CONTAINER="${POSTGRES_CONTAINER:-$(docker compose ps -q postgres 2>/dev/null || true)}"

echo "==> 1/3 Frontend unit tests (rota shift parsing + biometric)"
(cd frontend && npm test -- --run src/test/shiftCodeParse.test.ts src/test/biometricParser.test.ts)

if [[ -z "$CONTAINER" ]]; then
  echo "Postgres container not running — start stack first: docker compose up -d postgres"
  exit 1
fi

echo ""
echo "==> 2/3 Seed demo rota + overtime + payroll data"
docker exec -i "$CONTAINER" psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
  < scripts/db/seed-demo-rota-overtime.sql

echo ""
echo "==> 3/3 Verify API health"
HEALTH="$(curl -sf http://localhost:8080/api/v1/health || echo 'FAIL')"
echo "Health: $HEALTH"

echo ""
echo "=========================================="
echo "  HR MODULE TESTS COMPLETE"
echo "  Demo nurse: nurse.demo@jalaram.co.ke / DemoNurse2026!"
echo "  Check OT + payroll lines printed above."
echo "  UI: http://localhost:8080/rota"
echo "       http://localhost:8080/attendance/overtime"
echo "       http://localhost:8080/payroll"
echo "=========================================="
