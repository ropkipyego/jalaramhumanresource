/** Official staff email domain for Jalaram Hospital */
export const STAFF_EMAIL_DOMAIN = "jalaram.co.ke";

/** Build a staff login email from Staff ID when none is provided */
export function staffEmailFromId(staffId: string): string {
  const slug = staffId
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "");
  return `${slug || "staff"}@${STAFF_EMAIL_DOMAIN}`;
}

/** Normalize and validate that email uses @jalaram.co.ke */
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

/** Allow blank → auto-generate from staff ID; otherwise must be @jalaram.co.ke */
export function resolveStaffEmail(rawEmail: string, staffId: string): { email: string; error?: string } {
  const trimmed = (rawEmail || "").trim().toLowerCase();
  if (!trimmed || !trimmed.includes("@")) {
    if (!staffId?.trim()) return { email: "", error: "Staff ID required to generate email" };
    return { email: staffEmailFromId(staffId) };
  }
  return normalizeStaffEmail(trimmed);
}
