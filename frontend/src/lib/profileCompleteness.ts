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

/** Document uploads required before staff can use the rest of the app. */
export const REQUIRED_DOC_TYPES = [
  "ID_COPY",
  "KRA_PIN",
  "NSSF",
  "SHIF",
  "BANK_PROOF",
] as const;

const DOC_LABELS: Record<string, string> = {
  ID_COPY: "National ID copy",
  KRA_PIN: "KRA PIN document",
  NSSF: "NSSF document",
  SHIF: "SHIF document",
  BANK_PROOF: "Bank proof",
  LICENSE: "Practicing license",
};

export type DocRow = { kind?: string | null; doc_type?: string | null };

export function docTypeKey(row: DocRow): string {
  return String(row.doc_type || row.kind || "").toUpperCase();
}

function licenseRequired(profile?: ProfileLike): boolean {
  const p = profile ?? {};
  return filled(p.practicing_license_no) || filled(p.license_expiry_date);
}

export function documentCompleteness(docs: DocRow[], profile?: ProfileLike) {
  const present = new Set(docs.map(docTypeKey).filter(Boolean));
  const required: string[] = [...REQUIRED_DOC_TYPES];
  if (licenseRequired(profile)) required.push("LICENSE");
  const missing = required.filter((t) => !present.has(t)).map((t) => DOC_LABELS[t] || t);
  const done = required.length - missing.length;
  return {
    required: required.length,
    done,
    percent: required.length ? Math.round((done / required.length) * 100) : 100,
    missing,
    complete: missing.length === 0,
  };
}

export type StaffOnboardingStatus = {
  complete: boolean;
  percent: number;
  profileMissing: string[];
  documentsMissing: string[];
  documentsPercent: number;
};

export function staffOnboardingStatus(
  profile: ProfileLike,
  docs: DocRow[],
): StaffOnboardingStatus {
  const p = profile ?? {};
  const fieldList = STAFF_PROFILE_FIELDS.filter((f) => {
    if (f.phase === "License") return licenseRequired(profile);
    return true;
  });
  const profileMissing = fieldList.filter((f) => !filled(p[f.key])).map((f) => f.label);
  const docsStatus = documentCompleteness(docs, profile);
  const totalSteps = fieldList.length + docsStatus.required;
  const doneSteps = fieldList.length - profileMissing.length + docsStatus.done;
  return {
    complete: profileMissing.length === 0 && docsStatus.complete,
    percent: totalSteps ? Math.round((doneSteps / totalSteps) * 100) : 100,
    profileMissing,
    documentsMissing: docsStatus.missing,
    documentsPercent: docsStatus.percent,
  };
}

export function isStaffOnboardingComplete(profile: ProfileLike, docs: DocRow[]): boolean {
  return staffOnboardingStatus(profile, docs).complete;
}
