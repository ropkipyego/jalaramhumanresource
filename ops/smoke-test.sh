#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://127.0.0.1:8081}"
EMAIL="${EMAIL:-admin@jalaram.co.ke}"
PASSWORD="${PASSWORD:-JalaramAdmin2026!}"

echo "Jalaram HR smoke test"
echo "====================="
echo "Base URL: ${BASE_URL}"

wait_for() {
  local url="$1"
  local label="$2"
  for _ in $(seq 1 45); do
    if curl -fsS "$url" >/dev/null 2>&1; then
      echo "OK: ${label}"
      return 0
    fi
    sleep 2
  done
  echo "FAIL: ${label} — ${url}" >&2
  return 1
}

wait_for "${BASE_URL}/api/v1/health" "API health"
wait_for "${BASE_URL}/" "Frontend"

health="$(curl -fsS "${BASE_URL}/api/v1/health")"
echo "Health: ${health}"

login="$(curl -fsS -X POST "${BASE_URL}/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  --data "{\"email\":\"${EMAIL}\",\"password\":\"${PASSWORD}\"}")"

if [[ "$login" == *"accessToken"* ]]; then
  echo "OK: Super admin login"
else
  echo "FAIL: Login did not return accessToken" >&2
  echo "$login" >&2
  exit 1
fi

echo ""
echo "Smoke test passed."
