/** Official staff email domain for Jalaram Hospital (invite, bulk upload, validation) */
export const STAFF_EMAIL_DOMAIN =
  import.meta.env.VITE_STAFF_EMAIL_DOMAIN?.trim() || "jalaram.co.ke";

/** Super admin login email (platform operator — separate from staff domain) */
export const SUPER_ADMIN_EMAIL =
  import.meta.env.VITE_SUPER_ADMIN_EMAIL?.trim() || "admin@humasync.solutions";

/** Build a staff login email from Staff ID when none is provided */
export function staffEmailFromId(staffId: string): string {
  const slug = staffId
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "");
  return `${slug || "staff"}@${STAFF_EMAIL_DOMAIN}`;
}

/** Normalize and validate that email uses the staff domain */
export function normalizeStaffEmail(raw: string): { email: string; error?: string } {
  const email = (raw || "").trim().toLowerCase();
  if (!email) return { email: "", error: "Email is required" };
  if (!email.includes("@")) return { email, error: "Invalid email address" };
  const domain = email.split("@")[1];
  if (domain !== STAFF_EMAIL_DOMAIN) {
    return {
      email,
      error: `Email must use @${STAFF_EMAIL_DOMAIN} (e.g. name@${STAFF_EMAIL_DOMAIN})`,
    };
  }
  return { email };
}

/** Allow blank → auto-generate from staff ID; otherwise must use staff domain */
export function resolveStaffEmail(rawEmail: string, staffId: string): { email: string; error?: string } {
  const trimmed = (rawEmail || "").trim().toLowerCase();
  if (!trimmed || !trimmed.includes("@")) {
    if (!staffId?.trim()) return { email: "", error: "Staff ID required to generate email" };
    return { email: staffEmailFromId(staffId) };
  }
  return normalizeStaffEmail(trimmed);
}

/** Login accepts super-admin domain or staff domain */
export function isAllowedLoginEmail(email: string): boolean {
  const normalized = email.trim().toLowerCase();
  const domain = normalized.split("@")[1];
  if (!domain) return false;
  if (normalized === SUPER_ADMIN_EMAIL.toLowerCase()) return true;
  return domain === STAFF_EMAIL_DOMAIN;
}
