/** Public site URL for links in emails/docs. Falls back to current origin in the browser. */
export function getSiteUrl(): string {
  const fromEnv = import.meta.env.VITE_SITE_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  if (typeof window !== "undefined") return window.location.origin;
  return "https://jalaram-hr.vercel.app";
}
