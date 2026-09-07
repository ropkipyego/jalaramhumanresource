import type { AppRole } from "@/types/database";
import { supabase } from "@/integrations/supabase/client";

/** Roles that should use MFA when already enrolled (enrollment is optional until TOTP is enabled in Supabase) */
export const MFA_REQUIRED_ROLES: AppRole[] = ["ADMIN", "SUPER_ADMIN", "FINANCE_ADMIN"];

export function roleRequiresMfa(role: AppRole | null | undefined): boolean {
  return !!role && MFA_REQUIRED_ROLES.includes(role);
}

export type MfaGateState =
  | { status: "ok" }
  | { status: "loading" }
  | { status: "needs_enroll" }
  | { status: "needs_verify" }
  | { status: "error"; message: string };

/**
 * MFA gate:
 * - Non-admin → ok
 * - Admin with verified TOTP → must verify (aal2)
 * - Admin with no factors → ok (do not block login; enroll from Email & Security when ready)
 * - API errors → fail open so login still works if MFA is not configured in the project
 */
export async function resolveMfaGate(role: AppRole | null | undefined): Promise<MfaGateState> {
  if (!roleRequiresMfa(role)) return { status: "ok" };

  try {
    const { data: aal, error: aalErr } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aalErr) return { status: "ok" };

    const { data: factors, error: facErr } = await supabase.auth.mfa.listFactors();
    if (facErr) return { status: "ok" };

    const verified = (factors?.totp ?? []).filter((f) => f.status === "verified");
    if (verified.length === 0) return { status: "ok" };

    if (aal?.currentLevel === "aal2") return { status: "ok" };
    return { status: "needs_verify" };
  } catch {
    return { status: "ok" };
  }
}
