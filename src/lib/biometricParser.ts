/**
 * Multi-format biometric Excel parser.
 * Supports ZKTeco, Hikvision, and generic hospital exports.
 */

export type ParsedPunch = {
  row: number;
  staff_id: string;
  employee_id?: string;
  punch_at: string; // ISO string
  punch_type: "IN" | "OUT";
  source: "BIOMETRIC";
  device_id?: string;
  notes?: string;
};

export type ParseError = { row: number; staff_id?: string; error: string };

export type ParseResult = {
  format: string;
  punches: ParsedPunch[];
  errors: ParseError[];
  dateRange: { from: string | null; to: string | null };
};

const norm = (s: unknown) => String(s ?? "").trim().toLowerCase().replace(/[_\s]+/g, " ");

const matchHeader = (headers: string[], aliases: string[]) =>
  headers.findIndex((h) => aliases.some((a) => h === a || h.includes(a)));

const STAFF_ALIASES = [
  "staff id", "employee id", "emp id", "user id", "enroll no", "enroll number",
  "enrollment no", "badge", "pin", "personnel id", "id no", "empno", "emp no",
  "ac no", "account id", "userid",
];
const NAME_ALIASES = ["name", "full name", "employee name", "user name"];
const DATE_ALIASES = ["date", "work date", "attendance date", "punch date"];
const TIME_ALIASES = ["time", "punch time", "clock time"];
const DATETIME_ALIASES = ["datetime", "date time", "timestamp", "punch datetime", "check time"];
const IN_ALIASES = ["time in", "check in", "clock in", "in time", "in", "checkin", "timein"];
const OUT_ALIASES = ["time out", "check out", "clock out", "out time", "out", "checkout", "timeout"];
const TYPE_ALIASES = ["state", "type", "status", "punch type", "io", "check type", "verify mode"];

/** Parse Excel serial or string date+time into ISO */
function parseDateTime(
  dateVal: unknown,
  timeVal?: unknown,
  epoch?: Date,
): string | null {
  const combine = (d: Date, t?: string) => {
    if (t) {
      const m = t.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/);
      if (m) {
        d.setHours(+m[1], +m[2], m[3] ? +m[3] : 0, 0);
      }
    }
    return d.toISOString();
  };

  // Excel serial number (date or datetime)
  if (typeof dateVal === "number" && dateVal > 30000) {
    const ms = (dateVal - 25569) * 86400 * 1000;
    const d = new Date(ms);
    if (timeVal != null && timeVal !== "") {
      if (typeof timeVal === "number" && timeVal < 1) {
        // Excel time fraction
        const totalSec = Math.round(timeVal * 86400);
        d.setHours(0, 0, 0, 0);
        d.setSeconds(totalSec);
      } else {
        return combine(d, String(timeVal));
      }
    }
    return d.toISOString();
  }

  const dateStr = String(dateVal ?? "").trim();
  if (!dateStr) return null;

  // Combined datetime string
  if (dateStr.includes("T") || /\d{4}-\d{2}-\d{2}\s+\d{1,2}:\d{2}/.test(dateStr)) {
    const d = new Date(dateStr.replace(" ", "T"));
    return isNaN(d.getTime()) ? null : d.toISOString();
  }

  // Date only + separate time
  if (timeVal != null && timeVal !== "") {
    let timeStr = String(timeVal).trim();
    if (typeof timeVal === "number" && timeVal < 1) {
      const totalSec = Math.round(timeVal * 86400);
      const h = Math.floor(totalSec / 3600);
      const m = Math.floor((totalSec % 3600) / 60);
      const s = totalSec % 60;
      timeStr = `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    }
    const d = new Date(`${dateStr}T${timeStr.length <= 5 ? timeStr + ":00" : timeStr}`);
    if (!isNaN(d.getTime())) return d.toISOString();
    // dd/MM/yyyy format common in Kenya
    const dm = dateStr.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (dm) {
      const d2 = new Date(`${dm[3]}-${dm[2].padStart(2, "0")}-${dm[1].padStart(2, "0")}T${timeStr}`);
      if (!isNaN(d2.getTime())) return d2.toISOString();
    }
  }

  const d = new Date(dateStr);
  if (!isNaN(d.getTime())) return d.toISOString();

  if (epoch) return epoch.toISOString();
  return null;
}

function inferPunchType(raw: unknown): "IN" | "OUT" | null {
  const s = norm(raw);
  if (!s) return null;
  if (/^(in|check\s*in|c\s*\/?\s*in|0|1|punch\s*in|i)$/.test(s)) return "IN";
  if (/^(out|check\s*out|c\s*\/?\s*out|0|punch\s*out|o)$/.test(s)) return "OUT";
  // ZKTeco: 0 = Check In, 1 = Check Out (varies by device — also try reverse)
  if (s === "check in" || s === "checkin") return "IN";
  if (s === "check out" || s === "checkout") return "OUT";
  return null;
}

/** Alternate ZKTeco: State column numeric */
function inferPunchTypeNumeric(raw: unknown): "IN" | "OUT" | null {
  if (raw === 0 || raw === "0") return "IN";
  if (raw === 1 || raw === "1") return "OUT";
  return inferPunchType(raw);
}

export function parseBiometricSheet(aoa: unknown[][]): ParseResult {
  const errors: ParseError[] = [];
  const punches: ParsedPunch[] = [];

  if (aoa.length < 2) {
    return { format: "empty", punches: [], errors: [{ row: 0, error: "Sheet is empty" }], dateRange: { from: null, to: null } };
  }

  const headers = (aoa[0] as unknown[]).map(norm);
  const staffCol = matchHeader(headers, STAFF_ALIASES);
  const dateCol = matchHeader(headers, DATE_ALIASES);
  const timeCol = matchHeader(headers, TIME_ALIASES);
  const dtCol = matchHeader(headers, DATETIME_ALIASES);
  const inCol = matchHeader(headers, IN_ALIASES);
  const outCol = matchHeader(headers, OUT_ALIASES);
  const typeCol = matchHeader(headers, TYPE_ALIASES);

  let format = "unknown";
  if (dtCol >= 0 && staffCol >= 0) format = "zkteco-datetime";
  else if (inCol >= 0 && outCol >= 0 && (dateCol >= 0 || staffCol >= 0)) format = "daily-in-out";
  else if (dateCol >= 0 && timeCol >= 0 && staffCol >= 0) format = "date-time-split";
  else if (dateCol >= 0 && typeCol >= 0 && staffCol >= 0) format = "punch-log";

  if (staffCol < 0) {
    return {
      format,
      punches: [],
      errors: [{ row: 1, error: `Could not find Staff ID column. Expected one of: ${STAFF_ALIASES.slice(0, 5).join(", ")}…` }],
      dateRange: { from: null, to: null },
    };
  }

  const dataRows = aoa.slice(1);

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i] as unknown[];
    const rowNum = i + 2;
    const staffId = String(row[staffCol] ?? "").trim();
    if (!staffId) continue;

    // Format: daily with Time In + Time Out columns
    if (format === "daily-in-out" && inCol >= 0 && outCol >= 0) {
      const dateVal = dateCol >= 0 ? row[dateCol] : null;
      const inVal = row[inCol];
      const outVal = row[outCol];
      if (inVal != null && String(inVal).trim()) {
        const iso = parseDateTime(dateVal ?? new Date(), inVal);
        if (iso) punches.push({ row: rowNum, staff_id: staffId, punch_at: iso, punch_type: "IN", source: "BIOMETRIC" });
        else errors.push({ row: rowNum, staff_id: staffId, error: "Invalid Time In" });
      }
      if (outVal != null && String(outVal).trim()) {
        const iso = parseDateTime(dateVal ?? new Date(), outVal);
        if (iso) punches.push({ row: rowNum, staff_id: staffId, punch_at: iso, punch_type: "OUT", source: "BIOMETRIC" });
        else errors.push({ row: rowNum, staff_id: staffId, error: "Invalid Time Out" });
      }
      continue;
    }

    // Format: single datetime column (ZKTeco export)
    if (format === "zkteco-datetime" && dtCol >= 0) {
      const iso = parseDateTime(row[dtCol]);
      if (!iso) {
        errors.push({ row: rowNum, staff_id: staffId, error: "Invalid datetime" });
        continue;
      }
      let pType: "IN" | "OUT" = "IN";
      if (typeCol >= 0) {
        const inferred = inferPunchTypeNumeric(row[typeCol]);
        if (inferred) pType = inferred;
        else {
          // Alternate rows IN/OUT if no type column value
          pType = punches.filter((p) => p.staff_id === staffId && p.punch_at.slice(0, 10) === iso.slice(0, 10)).length % 2 === 0 ? "IN" : "OUT";
        }
      } else {
        pType = punches.filter((p) => p.staff_id === staffId && p.punch_at.slice(0, 10) === iso.slice(0, 10)).length % 2 === 0 ? "IN" : "OUT";
      }
      punches.push({ row: rowNum, staff_id: staffId, punch_at: iso, punch_type: pType, source: "BIOMETRIC" });
      continue;
    }

    // Format: date + time + optional type
    if (dateCol >= 0) {
      const dateVal = row[dateCol];
      const timeVal = timeCol >= 0 ? row[timeCol] : null;
      const iso = parseDateTime(dateVal, timeVal ?? undefined);
      if (!iso) {
        errors.push({ row: rowNum, staff_id: staffId, error: "Invalid date/time" });
        continue;
      }
      let pType: "IN" | "OUT" = "IN";
      if (typeCol >= 0) {
        const inferred = inferPunchTypeNumeric(row[typeCol]);
        pType = inferred ?? (punches.filter((p) => p.staff_id === staffId && p.punch_at.slice(0, 10) === iso.slice(0, 10)).length % 2 === 0 ? "IN" : "OUT");
      } else {
        pType = punches.filter((p) => p.staff_id === staffId && p.punch_at.slice(0, 10) === iso.slice(0, 10)).length % 2 === 0 ? "IN" : "OUT";
      }
      punches.push({ row: rowNum, staff_id: staffId, punch_at: iso, punch_type: pType, source: "BIOMETRIC" });
      continue;
    }

    errors.push({ row: rowNum, staff_id: staffId, error: "Unrecognized row format" });
  }

  // Sort punches chronologically per staff
  punches.sort((a, b) => a.punch_at.localeCompare(b.punch_at));

  let from: string | null = null;
  let to: string | null = null;
  for (const p of punches) {
    const d = p.punch_at.slice(0, 10);
    if (!from || d < from) from = d;
    if (!to || d > to) to = d;
  }

  return { format, punches, errors, dateRange: { from, to } };
}

/** Match parsed punches to employee UUIDs */
export function matchPunchesToEmployees(
  punches: ParsedPunch[],
  employees: { id: string; staff_id: string; biometric_enroll_id?: string | null }[],
): { matched: ParsedPunch[]; unmatched: ParseError[] } {
  const lookup = new Map<string, string>();
  for (const e of employees) {
    lookup.set(e.staff_id.trim().toUpperCase(), e.id);
    if (e.biometric_enroll_id) lookup.set(e.biometric_enroll_id.trim().toUpperCase(), e.id);
  }

  const matched: ParsedPunch[] = [];
  const unmatched: ParseError[] = [];

  for (const p of punches) {
    const empId = lookup.get(p.staff_id.trim().toUpperCase());
    if (empId) {
      matched.push({ ...p, employee_id: empId });
    } else {
      unmatched.push({ row: p.row, staff_id: p.staff_id, error: "Staff ID not found in system" });
    }
  }

  return { matched, unmatched };
}

export const SUPPORTED_FORMATS = [
  { name: "ZKTeco / Hikvision punch log", columns: "User ID | Name | DateTime | State (Check In/Out)" },
  { name: "Daily summary", columns: "Staff ID | Date | Time In | Time Out" },
  { name: "Split date/time", columns: "Staff ID | Date | Time | Type (optional)" },
];
