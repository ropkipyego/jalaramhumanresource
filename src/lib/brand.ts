/** Default brand mark — drop your official PNG/WebP at public/jalaram-logo.webp anytime. */
export const DEFAULT_LOGO_URL = "/jalaram-logo.svg";
export const FALLBACK_LOGO_URL =
  "https://storage.googleapis.com/gpt-engineer-file-uploads/gZoMjmA5yxZzjsxnev2nx3bpGjo1/social-images/social-1781599087550-HOSPITAL_(2).webp";

export function resolveLogoUrl(logoUrl?: string | null): string {
  if (logoUrl && String(logoUrl).trim()) return String(logoUrl).trim();
  return DEFAULT_LOGO_URL;
}
