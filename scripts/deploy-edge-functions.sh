#!/usr/bin/env bash
# Deploy Edge Functions required for staff invite / bulk / go-live password reset.
# Run from repo root after: supabase login && supabase link --project-ref sfziuvxfeyfhkzmcxpou
set -euo pipefail
cd "$(dirname "$0")/.."
supabase functions deploy go-live-credentials
supabase functions deploy create-staff-user
supabase functions deploy bulk-create-staff
supabase functions deploy send-invite
supabase functions deploy send-push || true
echo "Done. Test: System → Go-Live Credentials → Reset ALL"
