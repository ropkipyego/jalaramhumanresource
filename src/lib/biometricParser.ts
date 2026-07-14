/**
 * Biometric Excel parser.
 *
 * PRIMARY FORMAT (locked to the hospital's ZKTeco export):
 *   "Attendance Record Report" monthly matrix
 *   - Row 1: "Attendance Record Report"
 *   - A row containing "Att. Time" + a date range like "2026-06-01 ~ 2026-06-30"
 *   - Day-of-week row (MON TUE …)
 *   - Day-of-month row (1 2 3 … 30/31)  ← used as the column → date map
 *   - Then for every employee: an "ID: <enroll> Name: <name> <dept>" row,
 *     immediately followed by a row of punches per day. Each cell may contain
 *     0..N concatenated punches, e.g. "08:1318:04", "07:25 18:27",
 *     "08:2618:5618:59". Times alternate IN, OUT, IN, OUT…
 *
 * Fallback formats are still detected for older/other devices.
 */

export type ParsedPunch = {
  row: number;
  staff_id: string;      // enroll id or staff id used to match to profile
  employee_id?: string;
  full_name?: string;
  punch_at: string;      // ISO
  punch_type: "IN" | "OUT";
  source: "BIOMETRIC";
};

export type ParseError = { row: number; staff_id?: string; error: string };

export type ParseResult = {
  format: string;
  punches: ParsedPunch[];
  errors: ParseError[];
  dateRange: { from: string | null; to: string | null };
};

const cellStr = (v: unknown) => String(v ?? "").trim();
const norm = (v: unknown) => cellStr(v).toLowerCase().replace(/[_\s]+/g, " ");

/* -------------------------------------------------------------------------- */
/*  PRIMARY: ZKTeco "Attendance Record Report" monthly matrix                 */
/* -------------------------------------------------------------------------- */

function isZktecoMatrix(aoa: unknown[][]): boolean {
  for (let r = 0; r < Math.min(aoa.length, 10); r++) {
    for (const c of aoa[r] || []) {
      const s = norm(c);
      if (s.startsWith("attendance record report")) return true;
      if (s === "att time" || s === "att. time") return true;
    }
  }
  return false;
}

function findDateRange(aoa: unknown[][]): { from: Date; to: Date } | null {
  const re = /(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})\s*[~\-–to]+\s*(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/;
  for (let r = 0; r < Math.min(aoa.length, 15); r++) {
    for (const c of aoa[r] || []) {
      const s = cellStr(c);
      const m = s.match(re);
      if (m) {
        return {
          from: new Date(+m[1], +m[2] - 1, +m[3]),
          to: new Date(+m[4], +m[5] - 1, +m[6]),
        };
      }
    }
  }
  return null;
}

function findDayOfMonthRow(aoa: unknown[][]): number {
  for (let r = 0; r < Math.min(aoa.length, 20); r++) {
    const row = aoa[r] || [];
    let count = 0;
    for (const c of row) {
      const n = Number(c);
      if (Number.isInteger(n) && n >= 1 && n <= 31) count++;
    }
    if (count >= 15) return r;
  }
  return -1;
}

function extractTimesFromCell(cell: string): string[] {
  // Accept HH:MM (with or without seconds/colons). Concatenated 4-digit pairs
  // like "08:1318:04" or "082618561859" should split into 08:13,18:04 or
  // 08:26,18:56,18:59. Strategy: scan sliding pairs of (HH)(MM).
  const cleaned = cell.replace(/[^0-9:]/g, " ").trim();
  if (!cleaned) return [];
  const out: string[] = [];
  const push = (h: number, m: number) => {
    if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
      out.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    }
  };
  const tokens = cleaned.split(/\s+/);
  for (const t of tokens) {
    if (t.includes(":")) {
      // "08:1318:04"  or "08:13"
      const parts = t.split(":").filter(Boolean);
      // Rebuild by pulling 2 digits at a time
      const digits = parts.join("");
      for (let i = 0; i + 4 <= digits.length; i += 4) {
        push(+digits.slice(i, i + 2), +digits.slice(i + 2, i + 4));
      }
    } else {
      // pure digits e.g. "081318041859"
      for (let i = 0; i + 4 <= t.length; i += 4) {
        push(+t.slice(i, i + 2), +t.slice(i + 2, i + 4));
      }
    }
  }
  // dedupe adjacent duplicates while preserving order
  return out.filter((v, i, a) => v !== a[i - 1]);
}

function parseZktecoMatrix(aoa: unknown[][]): ParseResult {
  const errors: ParseError[] = [];
  const punches: ParsedPunch[] = [];

  const range = findDateRange(aoa);
  const dayRow = findDayOfMonthRow(aoa);
  if (!range || dayRow < 0) {
    return {
      format: "zkteco-monthly-matrix",
      punches: [],
      errors: [{ row: 0, error: "Could not detect date range or day-of-month header row" }],
      dateRange: { from: null, to: null },
    };
  }
  const year = range.from.getFullYear();
  const month = range.from.getMonth();

  const colMap: { col: number; date: Date }[] = [];
  const headerRow = aoa[dayRow] || [];
  for (let c = 0; c < headerRow.length; c++) {
    const n = Number(headerRow[c]);
    if (Number.isInteger(n) && n >= 1 && n <= 31) {
      colMap.push({ col: c, date: new Date(year, month, n) });
    }
  }

  for (let r = dayRow + 1; r < aoa.length; r++) {
    const row = aoa[r] || [];
    const idIdx = row.findIndex((v) => {
      const s = norm(v);
      return s === "id:" || s === "id" || s.startsWith("id:");
    });
    if (idIdx < 0) continue;

    let enrollId = "";
    let fullName = "";
    for (let j = idIdx + 1; j < row.length; j++) {
      const v = cellStr(row[j]);
      if (v) { enrollId = v; break; }
    }
    const nameIdx = row.findIndex((v) => norm(v) === "name:" || norm(v).startsWith("name:"));
    if (nameIdx >= 0) {
      for (let j = nameIdx + 1; j < row.length; j++) {
        const v = cellStr(row[j]);
        if (v) { fullName = v; break; }
      }
    }
    if (!enrollId) continue;

    const punchRow = aoa[r + 1] || [];
    for (const { col, date } of colMap) {
      const raw = cellStr(punchRow[col]);
      if (!raw) continue;
      const times = extractTimesFromCell(raw);
      times.forEach((t, idx) => {
        const [hh, mm] = t.split(":").map(Number);
        const dt = new Date(date.getFullYear(), date.getMonth(), date.getDate(), hh, mm, 0);
        punches.push({
          row: r + 2,
          staff_id: enrollId,
          full_name: fullName || undefined,
          punch_at: dt.toISOString(),
          punch_type: idx % 2 === 0 ? "IN" : "OUT",
          source: "BIOMETRIC",
        });
      });
    }

    // Skip the punch row we just consumed
    r += 1;
  }

  punches.sort((a, b) => a.punch_at.localeCompare(b.punch_at));
  return {
    format: "zkteco-monthly-matrix",
    punches,
    errors,
    dateRange: {
      from: range.from.toISOString().slice(0, 10),
      to: range.to.toISOString().slice(0, 10),
    },
  };
}

/* -------------------------------------------------------------------------- */
/*  FALLBACK: simple daily / punch-log formats                                */
/* -------------------------------------------------------------------------- */

const STAFF_ALIASES = [
  "staff id","employee id","emp id","user id","enroll no","enroll number",
  "enrollment no","badge","pin","personnel id","id no","empno","emp no",
  "ac no","account id","userid",
];
const DATE_ALIASES = ["date","work date","attendance date","punch date"];
const TIME_ALIASES = ["time","punch time","clock time"];
const DATETIME_ALIASES = ["datetime","date time","timestamp","punch datetime","check time"];
const IN_ALIASES = ["time in","check in","clock in","in time","in","checkin","timein"];
const OUT_ALIASES = ["time out","check out","clock out","out time","out","checkout","timeout"];
const TYPE_ALIASES = ["state","type","status","punch type","io","check type","verify mode"];

const matchHeader = (h: string[], a: string[]) =>
  h.findIndex((x) => a.some((k) => x === k || x.includes(k)));

function parseDateTime(dateVal: unknown, timeVal?: unknown): string | null {
  if (typeof dateVal === "number" && dateVal > 30000) {
    const ms = (dateVal - 25569) * 86400 * 1000;
    const d = new Date(ms);
    if (timeVal != null && timeVal !== "") {
      if (typeof timeVal === "number" && timeVal < 1) {
        d.setHours(0, 0, 0, 0); d.setSeconds(Math.round(timeVal * 86400));
      } else {
        const m = String(timeVal).match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
        if (m) d.setHours(+m[1], +m[2], m[3] ? +m[3] : 0, 0);
      }
    }
    return d.toISOString();
  }
  const s = cellStr(dateVal);
  if (!s) return null;
  if (s.includes("T") || /\d{4}-\d{1,2}-\d{1,2}\s+\d{1,2}:\d{2}/.test(s)) {
    const d = new Date(s.replace(" ", "T"));
    return isNaN(d.getTime()) ? null : d.toISOString();
  }
  if (timeVal != null && timeVal !== "") {
    let tStr = String(timeVal).trim();
    if (typeof timeVal === "number" && timeVal < 1) {
      const sec = Math.round(timeVal * 86400);
      const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), sc = sec % 60;
      tStr = `${h}:${String(m).padStart(2,"0")}:${String(sc).padStart(2,"0")}`;
    }
    const d = new Date(`${s}T${tStr.length <= 5 ? tStr + ":00" : tStr}`);
    if (!isNaN(d.getTime())) return d.toISOString();
    const dm = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (dm) {
      const d2 = new Date(`${dm[3]}-${dm[2].padStart(2,"0")}-${dm[1].padStart(2,"0")}T${tStr}`);
      if (!isNaN(d2.getTime())) return d2.toISOString();
    }
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

function inferType(raw: unknown): "IN" | "OUT" | null {
  if (raw === 0 || raw === "0") return "IN";
  if (raw === 1 || raw === "1") return "OUT";
  const s = norm(raw);
  if (!s) return null;
  if (/^(in|check ?in|c ?\/? ?in|punch ?in|i)$/.test(s)) return "IN";
  if (/^(out|check ?out|c ?\/? ?out|punch ?out|o)$/.test(s)) return "OUT";
  return null;
}

function parseFallback(aoa: unknown[][]): ParseResult {
  const errors: ParseError[] = [];
  const punches: ParsedPunch[] = [];
  if (aoa.length < 2) return { format: "empty", punches, errors: [{ row: 0, error: "Empty sheet" }], dateRange: { from: null, to: null } };
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
  else if (dateCol >= 0 && staffCol >= 0) format = "date-time-split";

  if (staffCol < 0) {
    return { format, punches, errors: [{ row: 1, error: "Could not detect Staff ID column" }], dateRange: { from: null, to: null } };
  }

  for (let i = 1; i < aoa.length; i++) {
    const row = aoa[i] as unknown[];
    const rn = i + 1;
    const staffId = cellStr(row[staffCol]);
    if (!staffId) continue;

    if (format === "daily-in-out") {
      const dv = dateCol >= 0 ? row[dateCol] : null;
      if (row[inCol] != null && cellStr(row[inCol])) {
        const iso = parseDateTime(dv ?? new Date(), row[inCol]);
        if (iso) punches.push({ row: rn, staff_id: staffId, punch_at: iso, punch_type: "IN", source: "BIOMETRIC" });
      }
      if (row[outCol] != null && cellStr(row[outCol])) {
        const iso = parseDateTime(dv ?? new Date(), row[outCol]);
        if (iso) punches.push({ row: rn, staff_id: staffId, punch_at: iso, punch_type: "OUT", source: "BIOMETRIC" });
      }
      continue;
    }
    const iso = format === "zkteco-datetime"
      ? parseDateTime(row[dtCol])
      : parseDateTime(row[dateCol], timeCol >= 0 ? row[timeCol] : undefined);
    if (!iso) { errors.push({ row: rn, staff_id: staffId, error: "Invalid date/time" }); continue; }
    const pType: "IN" | "OUT" =
      (typeCol >= 0 ? inferType(row[typeCol]) : null) ??
      (punches.filter((p) => p.staff_id === staffId && p.punch_at.slice(0,10) === iso.slice(0,10)).length % 2 === 0 ? "IN" : "OUT");
    punches.push({ row: rn, staff_id: staffId, punch_at: iso, punch_type: pType, source: "BIOMETRIC" });
  }

  punches.sort((a, b) => a.punch_at.localeCompare(b.punch_at));
  let from: string | null = null, to: string | null = null;
  for (const p of punches) {
    const d = p.punch_at.slice(0, 10);
    if (!from || d < from) from = d;
    if (!to || d > to) to = d;
  }
  return { format, punches, errors, dateRange: { from, to } };
}

/* -------------------------------------------------------------------------- */
export function parseBiometricSheet(aoa: unknown[][]): ParseResult {
  if (isZktecoMatrix(aoa)) return parseZktecoMatrix(aoa);
  return parseFallback(aoa);
}

export function matchPunchesToEmployees(
  punches: ParsedPunch[],
  employees: { id: string; staff_id: string; biometric_enroll_id?: string | null; full_name?: string }[],
): { matched: ParsedPunch[]; unmatched: ParseError[] } {
  const byKey = new Map<string, string>();
  const byName = new Map<string, string>();
  for (const e of employees) {
    byKey.set(e.staff_id.trim().toUpperCase(), e.id);
    if (e.biometric_enroll_id) byKey.set(e.biometric_enroll_id.trim().toUpperCase(), e.id);
    if (e.full_name) byName.set(e.full_name.trim().toUpperCase(), e.id);
  }
  const matched: ParsedPunch[] = [];
  const unmatched: ParseError[] = [];
  for (const p of punches) {
    let empId = byKey.get(p.staff_id.trim().toUpperCase());
    if (!empId && p.full_name) empId = byName.get(p.full_name.trim().toUpperCase());
    if (empId) matched.push({ ...p, employee_id: empId });
    else unmatched.push({ row: p.row, staff_id: p.staff_id, error: `Enroll ID "${p.staff_id}"${p.full_name ? ` (${p.full_name})` : ""} not mapped to a staff profile` });
  }
  return { matched, unmatched };
}

export const SUPPORTED_FORMATS = [
  { name: "ZKTeco Monthly Matrix (PRIMARY)", columns: "Attendance Record Report · one row of dates · ID/Name row + punches row per staff" },
  { name: "ZKTeco / Hikvision punch log", columns: "User ID | Name | DateTime | State (Check In/Out)" },
  { name: "Daily summary", columns: "Staff ID | Date | Time In | Time Out" },
];
