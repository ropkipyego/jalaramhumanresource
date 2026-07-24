#!/usr/bin/env bash
# ============================================================================
# ONE script — deploy all go-live Edge Functions
#
# From repo root:
#   bash scripts/deploy-edge-functions.sh
#
# First time only (same terminal session):
#   npx supabase login
#   (browser opens — use the account that owns project sfziuvxfeyfhkzmcxpou)
# ============================================================================
set -euo pipefail
cd "$(dirname "$0")/.."

PROJECT_REF="${SUPABASE_PROJECT_REF:-sfziuvxfeyfhkzmcxpou}"

if ! command -v supabase >/dev/null 2>&1 && ! command -v npx >/dev/null 2>&1; then
  echo "Install Node.js / npm first, then re-run."
  exit 1
fi

# Prefer local npx so you don't need a global install
SUPABASE=(npx --yes supabase)

echo "→ Project: $PROJECT_REF"
echo "→ Linking (may ask for DB password from Supabase → Settings → Database)..."
"${SUPABASE[@]}" link --project-ref "$PROJECT_REF" || {
  echo ""
  echo "LINK FAILED — usually wrong Supabase login (not the Lovable project owner)."
  echo "Fix: npx supabase logout && npx supabase login"
  echo "Then open https://supabase.com/dashboard/project/$PROJECT_REF and confirm you can see it."
  exit 1
}

FUNCS=(
  go-live-credentials
  create-staff-user
  bulk-create-staff
  send-invite
)

echo "→ Deploying ${#FUNCS[@]} functions..."
for fn in "${FUNCS[@]}"; do
  echo "  • $fn"
  "${SUPABASE[@]}" functions deploy "$fn" --no-verify-jwt --project-ref "$PROJECT_REF"
done

echo ""
echo "Done. All 4 functions deployed."
echo "Test in app: Staff → employee → Login → Save email"
echo "Or: System → Go-Live Credentials → Reset"
echo ""
echo "Optional secrets (Supabase → Edge Functions → Secrets):"
echo "  SITE_URL=https://jalaramhumanresource.lovable.app"
echo "  RESEND_API_KEY=...   (only if invite emails should send)"
