import type { AppRole } from "@/types/database";
import { supabase } from "@/integrations/supabase/client";

/** Roles that must enroll and use TOTP MFA before accessing the app */
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

export async function resolveMfaGate(role: AppRole | null | undefined): Promise<MfaGateState> {
  if (!roleRequiresMfa(role)) return { status: "ok" };

  const { data: aal, error: aalErr } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aalErr) return { status: "error", message: aalErr.message };

  const { data: factors, error: facErr } = await supabase.auth.mfa.listFactors();
  if (facErr) return { status: "error", message: facErr.message };

  const verified = (factors?.totp ?? []).filter((f) => f.status === "verified");
  if (verified.length === 0) return { status: "needs_enroll" };

  if (aal?.currentLevel === "aal2") return { status: "ok" };
  if (aal?.nextLevel === "aal2") return { status: "needs_verify" };

  // Has factors but session is not elevated — challenge
  return { status: "needs_verify" };
}
