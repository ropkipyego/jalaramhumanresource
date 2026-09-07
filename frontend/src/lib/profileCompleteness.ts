/** Simple profile / employee-file completeness for staff + HR. */

export type ProfileLike = Record<string, unknown> | null | undefined;

function filled(v: unknown): boolean {
  if (v === null || v === undefined) return false;
  if (typeof v === "number") return !Number.isNaN(v) && v > 0;
  return String(v).trim().length > 0;
}

/** Staff fill these (contact + statutory + license + bank). */
export const STAFF_PROFILE_FIELDS: { key: string; label: string; phase: string }[] = [
  { key: "phone", label: "Phone", phase: "Contact" },
  { key: "address", label: "Address", phase: "Contact" },
  { key: "next_of_kin_name", label: "Next of kin name", phase: "Contact" },
  { key: "next_of_kin_phone", label: "Next of kin phone", phase: "Contact" },
  { key: "national_id", label: "National ID", phase: "Statutory" },
  { key: "kra_pin", label: "KRA PIN", phase: "Statutory" },
  { key: "nssf_number", label: "NSSF number", phase: "Statutory" },
  { key: "shif_number", label: "SHIF number", phase: "Statutory" },
  { key: "practicing_license_no", label: "License number", phase: "License" },
  { key: "license_expiry_date", label: "License expiry", phase: "License" },
  { key: "bank_name", label: "Bank name", phase: "Bank" },
  { key: "bank_branch", label: "Bank branch", phase: "Bank" },
  { key: "bank_account", label: "Bank account", phase: "Bank" },
];

/** HR / Finance only — salary & job. */
export const HR_PROFILE_FIELDS: { key: string; label: string }[] = [
  { key: "basic_salary", label: "Basic salary" },
  { key: "designation", label: "Designation" },
  { key: "date_joined", label: "Date joined" },
];

export type CompletenessResult = {
  percent: number;
  done: number;
  total: number;
  missing: string[];
  staffPercent: number;
  hrPercent: number;
  staffMissing: string[];
  hrMissing: string[];
};

export function profileCompleteness(profile: ProfileLike): CompletenessResult {
  const p = profile ?? {};
  const staffMissing = STAFF_PROFILE_FIELDS.filter((f) => !filled(p[f.key])).map((f) => f.label);
  const hrMissing = HR_PROFILE_FIELDS.filter((f) => !filled(p[f.key])).map((f) => f.label);
  const staffDone = STAFF_PROFILE_FIELDS.length - staffMissing.length;
  const hrDone = HR_PROFILE_FIELDS.length - hrMissing.length;
  const done = staffDone + hrDone;
  const total = STAFF_PROFILE_FIELDS.length + HR_PROFILE_FIELDS.length;
  return {
    percent: total ? Math.round((done / total) * 100) : 0,
    done,
    total,
    missing: [...staffMissing, ...hrMissing],
    staffPercent: STAFF_PROFILE_FIELDS.length
      ? Math.round((staffDone / STAFF_PROFILE_FIELDS.length) * 100)
      : 0,
    hrPercent: HR_PROFILE_FIELDS.length
      ? Math.round((hrDone / HR_PROFILE_FIELDS.length) * 100)
      : 0,
    staffMissing,
    hrMissing,
  };
}

export function phasePercent(profile: ProfileLike, phase: string): number {
  const p = profile ?? {};
  const fields = STAFF_PROFILE_FIELDS.filter((f) => f.phase === phase);
  if (!fields.length) return 0;
  const done = fields.filter((f) => filled(p[f.key])).length;
  return Math.round((done / fields.length) * 100);
}
