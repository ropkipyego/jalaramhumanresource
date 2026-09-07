#!/usr/bin/env bash
# Production readiness checks before Contabo deploy
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

COMPOSE=(docker compose -f docker-compose.yml -f docker-compose.prod.yml)

missing=0
warn=0

ok() { echo "OK: $1"; }
fail() { echo "FAIL: $1"; missing=1; }
warn_msg() { echo "WARN: $1"; warn=1; }

echo "Jalaram HR production preflight"
echo "================================"

command -v docker >/dev/null && ok "docker" || fail "docker not installed"
docker compose version >/dev/null 2>&1 && ok "docker compose" || fail "docker compose missing"
test -f .env && ok ".env exists" || fail ".env missing — cp .env.production.example .env"

if [[ -f .env ]]; then
  set -a && source .env && set +a
  [[ "${JWT_ACCESS_SECRET:-}" == *"CHANGE_ME"* || "${JWT_ACCESS_SECRET:-}" == *"replace-with"* ]] \
    && fail "JWT_ACCESS_SECRET still placeholder" || ok "JWT_ACCESS_SECRET set"
  [[ "${POSTGRES_PASSWORD:-}" == *"CHANGE_ME"* || "${POSTGRES_PASSWORD:-}" == "change-me-strong-password" ]] \
    && warn_msg "POSTGRES_PASSWORD looks weak or default" || ok "POSTGRES_PASSWORD set"
  [[ "${SUPER_ADMIN_PASSWORD:-}" == *"CHANGE_ME"* || "${SUPER_ADMIN_PASSWORD:-}" == "JalaramAdmin2026!" ]] \
    && warn_msg "SUPER_ADMIN_PASSWORD still default — change before go-live" || ok "SUPER_ADMIN_PASSWORD customized"
  [[ -n "${FRONTEND_ORIGIN:-}" && "${FRONTEND_ORIGIN}" == https://* ]] \
    && ok "FRONTEND_ORIGIN uses HTTPS" || warn_msg "FRONTEND_ORIGIN should be https://your-domain"
  [[ "${VITE_SUPABASE_URL:-}" == "${FRONTEND_ORIGIN:-}" ]] \
    && ok "VITE_SUPABASE_URL matches FRONTEND_ORIGIN" || warn_msg "VITE_SUPABASE_URL should match FRONTEND_ORIGIN"
fi

echo ""
if [[ "$missing" -eq 0 ]]; then
  echo "Preflight passed${warn:+ (with warnings)}."
  exit 0
fi
echo "Preflight failed — fix items above before deploy."
exit 1
