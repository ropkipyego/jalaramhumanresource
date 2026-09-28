/** Official Jalaram Hospital mark (also copied to public/jalaram-logo.png for offline deploy). */
export const OFFICIAL_LOGO_URL = "https://jalaram.co.ke/assets/Logo-Final.png";

/** Served from the app bundle — same file as OFFICIAL_LOGO_URL. */
export const DEFAULT_LOGO_URL = "/jalaram-logo.png";

export const FALLBACK_LOGO_URL = OFFICIAL_LOGO_URL;

export function resolveLogoUrl(logoUrl?: string | null): string {
  if (logoUrl && String(logoUrl).trim()) return String(logoUrl).trim();
  return DEFAULT_LOGO_URL;
}
