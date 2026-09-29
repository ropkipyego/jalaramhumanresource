/**
 * Biometric Excel parser.
 *
 * PRIMARY FORMAT (Jalaram / ZKTeco device export):
 *   "Attendance Record Report" monthly matrix
 *   - Title row: "Attendance Record Report"
 *   - Optional: "Att. Time" + "2026-08-01 ~ 2026-08-31"
 *   - Day-of-week row, then day-of-month row (may be partial month / multi-page)
 *   - Per employee: "ID: <enroll> Name: <name>" (optional "Dept.: …")
 *   - Next row: punches per day (concatenated times, alternated IN/OUT)
 *
 * Matching key: **device Enroll ID** (`profiles.biometric_enroll_id`), with name + department
 * used to resolve ambiguities against department rosters.
 */

export type ParsedPunch = {
  row: number;
  staff_id: string;
  employee_id?: string;
  full_name?: string;
  department_name?: string;
  punch_at: string;
  punch_type: "IN" | "OUT";
  source: "BIOMETRIC";
};

export type ParseError = { row: number; staff_id?: string; error: string };

export type ParseResult = {
  format: string;
  punches: ParsedPunch[];
  errors: ParseError[];
  dateRange: { from: string | null; to: string | null };
  needsReferenceMonth?: boolean;
};

export type ParseBiometricOptions = {
  /** First day of report month when the file has no "Att. Time" range (YYYY-MM). */
  referenceMonth?: string;
  fileName?: string;
};

const cellStr = (v: unknown) => String(v ?? "").trim();
const norm = (v: unknown) => cellStr(v).toLowerCase().replace(/[_\s]+/g, " ");

const MONTH_INDEX: Record<string, number> = {
  january: 0, jan: 0, february: 1, feb: 1, march: 2, mar: 2, april: 3, apr: 3,
  may: 4, june: 5, jun: 5, july: 6, jul: 6, august: 7, aug: 7,
  september: 8, sep: 8, sept: 8, october: 9, oct: 9, november: 10, nov: 10,
  december: 11, dec: 11,
};

export function inferReferenceMonthFromFileName(fileName: string): string | null {
  const base = fileName.replace(/\.[^.]+$/, "").toLowerCase();
  const yearM = base.match(/(20\d{2})/);
  const year = yearM ? +yearM[1] : new Date().getFullYear();
  const keys = Object.keys(MONTH_INDEX).sort((a, b) => b.length - a.length);
  for (const key of keys) {
    if (base.includes(key)) {
      return `${year}-${String(MONTH_INDEX[key] + 1).padStart(2, "0")}`;
    }
  }
  return null;
}

/* -------------------------------------------------------------------------- */
/*  PRIMARY: ZKTeco "Attendance Record Report" monthly matrix                 */
/* -------------------------------------------------------------------------- */

function isZktecoMatrix(aoa: unknown[][]): boolean {
  for (let r = 0; r < Math.min(aoa.length, 12); r++) {
    for (const c of aoa[r] || []) {
      const s = norm(c);
      if (s.includes("attendance record report")) return true;
      if (s === "att time" || s === "att. time") return true;
    }
  }
  return false;
}

function findDateRange(aoa: unknown[][]): { from: Date; to: Date } | null {
  const re =
    /(\d{4})[-/](\d{1,2})[-/](\d{1,2})\s*[~\-–to]+\s*(\d{4})[-/](\d{1,2})[-/](\d{1,2})/;
  for (let r = 0; r < Math.min(aoa.length, 20); r++) {
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

function resolveReferenceMonth(
  aoa: unknown[][],
  options?: ParseBiometricOptions,
): { year: number; month: number } | null {
  const range = findDateRange(aoa);
  if (range) return { year: range.from.getFullYear(), month: range.from.getMonth() };
  const ref = options?.referenceMonth?.trim();
  if (ref && /^\d{4}-\d{2}$/.test(ref)) {
    const [y, m] = ref.split("-").map(Number);
    return { year: y, month: m - 1 };
  }
  if (options?.fileName) {
    const inferred = inferReferenceMonthFromFileName(options.fileName);
    if (inferred) {
      const [y, m] = inferred.split("-").map(Number);
      return { year: y, month: m - 1 };
    }
  }
  return null;
}

function countDayNumbers(row: unknown[]): number {
  let count = 0;
  for (const c of row) {
    const n = Number(cellStr(c));
    if (Number.isInteger(n) && n >= 1 && n <= 31) count++;
  }
  return count;
}

function isDayOfMonthHeaderRow(row: unknown[]): boolean {
  return countDayNumbers(row) >= 7;
}

type ColDate = { col: number; date: Date };

function buildColMapFromDayRow(
  row: unknown[],
  startYear: number,
  startMonth: number,
  prevLastDay: number,
): { map: ColDate[]; lastDay: number } {
  const days: { col: number; day: number }[] = [];
  for (let c = 0; c < row.length; c++) {
    const n = Number(cellStr(row[c]));
    if (Number.isInteger(n) && n >= 1 && n <= 31) days.push({ col: c, day: n });
  }
  let y = startYear;
  let m = startMonth;
  let prev = prevLastDay;
  const map: ColDate[] = [];
  for (const { col, day } of days) {
    if (prev >= 28 && day < prev - 3) {
      m += 1;
      if (m > 11) {
        m = 0;
        y += 1;
      }
    }
    map.push({ col, date: new Date(y, m, day) });
    prev = day;
  }
  return { map, lastDay: prev };
}

function parseEmployeeHeader(row: unknown[]): {
  enrollId: string;
  fullName: string;
  department?: string;
} | null {
  const joined = row.map(cellStr).filter(Boolean).join(" ");
  if (!/id\s*:/i.test(joined)) return null;

  const block = joined.match(
    /id\s*:\s*(\S+)\s+name\s*:\s*(.+?)(?:\s+dept\.?\s*:\s*(.+))?$/i,
  );
  if (block) {
    return {
      enrollId: block[1].trim(),
      fullName: block[2].trim(),
      department: block[3]?.trim(),
    };
  }

  let enrollId = "";
  let fullName = "";
  let department: string | undefined;
  const idIdx = row.findIndex((v) => /id\s*:/i.test(cellStr(v)));
  if (idIdx < 0) return null;
  const idCell = cellStr(row[idIdx]);
  const idInline = idCell.match(/id\s*:\s*(\S+)/i);
  if (idInline) enrollId = idInline[1];
  else {
    for (let j = idIdx + 1; j < row.length; j++) {
      const v = cellStr(row[j]);
      if (v && !/^name\s*:/i.test(v)) {
        enrollId = v;
        break;
      }
    }
  }
  const nameIdx = row.findIndex((v) => /name\s*:/i.test(cellStr(v)));
  if (nameIdx >= 0) {
    const nameCell = cellStr(row[nameIdx]);
    const nameInline = nameCell.match(/name\s*:\s*(.+)/i);
    if (nameInline) fullName = nameInline[1].trim();
    else {
      for (let j = nameIdx + 1; j < row.length; j++) {
        const v = cellStr(row[j]);
        if (v) {
          fullName = v;
          break;
        }
      }
    }
  }
  const deptM = joined.match(/dept\.?\s*:\s*(.+)/i);
  if (deptM) department = deptM[1].trim();
  if (!enrollId) return null;
  return { enrollId, fullName, department };
}

function parseDeptOnlyRow(row: unknown[]): string | null {
  const joined = row.map(cellStr).filter(Boolean).join(" ");
  if (!/dept\.?\s*:/i.test(joined)) return null;
  if (/id\s*:/i.test(joined)) return null;
  const m = joined.match(/dept\.?\s*:\s*(.*)$/i);
  const name = m?.[1]?.trim();
  return name || "";
}

function rowLooksLikePunchRow(row: unknown[]): boolean {
  let hits = 0;
  for (const c of row) {
    const s = cellStr(c);
    if (!s) continue;
    if (/\d{1,2}:\d{2}/.test(s) || /\d{4,}/.test(s.replace(/:/g, ""))) hits++;
  }
  return hits >= 2;
}

function extractTimesFromCell(cell: string): string[] {
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
      const parts = t.split(":").filter(Boolean);
      const digits = parts.join("");
      for (let i = 0; i + 4 <= digits.length; i += 4) {
        push(+digits.slice(i, i + 2), +digits.slice(i + 2, i + 4));
      }
    } else {
      for (let i = 0; i + 4 <= t.length; i += 4) {
        push(+t.slice(i, i + 2), +t.slice(i + 2, i + 4));
      }
    }
  }
  return out.filter((v, i, a) => v !== a[i - 1]);
}

function ingestPunchRow(
  punchRow: unknown[],
  colMap: ColDate[],
  enrollId: string,
  fullName: string,
  department: string | undefined,
  rowNum: number,
  punches: ParsedPunch[],
) {
  for (const { col, date } of colMap) {
    const raw = cellStr(punchRow[col]);
    if (!raw) continue;
    const times = extractTimesFromCell(raw);
    times.forEach((t, idx) => {
      const [hh, mm] = t.split(":").map(Number);
      const dt = new Date(date.getFullYear(), date.getMonth(), date.getDate(), hh, mm, 0);
      punches.push({
        row: rowNum,
        staff_id: enrollId,
        full_name: fullName || undefined,
        department_name: department,
        punch_at: dt.toISOString(),
        punch_type: idx % 2 === 0 ? "IN" : "OUT",
        source: "BIOMETRIC",
      });
    });
  }
}

function parseZktecoMatrix(aoa: unknown[][], options?: ParseBiometricOptions): ParseResult {
  const errors: ParseError[] = [];
  const punches: ParsedPunch[] = [];

  const range = findDateRange(aoa);
  const ref = resolveReferenceMonth(aoa, options);
  if (!ref) {
    return {
      format: "zkteco-monthly-matrix",
      punches: [],
      errors: [],
      dateRange: { from: null, to: null },
      needsReferenceMonth: true,
    };
  }

  let colMap: ColDate[] = [];
  let prevLastDay = -1;
  let currentDept = "";
  let lastEmployee: { enrollId: string; fullName: string; department?: string } | null = null;

  for (let r = 0; r < aoa.length; r++) {
    const row = aoa[r] || [];

    if (isDayOfMonthHeaderRow(row)) {
      const built = buildColMapFromDayRow(row, ref.year, ref.month, prevLastDay);
      colMap = built.map;
      prevLastDay = built.lastDay;
      continue;
    }

    const deptOnly = parseDeptOnlyRow(row);
    if (deptOnly !== null) {
      currentDept = deptOnly;
      if (rowLooksLikePunchRow(row) && lastEmployee && colMap.length) {
        ingestPunchRow(
          row,
          colMap,
          lastEmployee.enrollId,
          lastEmployee.fullName,
          currentDept || lastEmployee.department,
          r + 1,
          punches,
        );
      }
      continue;
    }

    const emp = parseEmployeeHeader(row);
    if (emp) {
      lastEmployee = {
        ...emp,
        department: emp.department || currentDept || undefined,
      };
      const punchRow = aoa[r + 1] || [];
      if (colMap.length && rowLooksLikePunchRow(punchRow)) {
        ingestPunchRow(
          punchRow,
          colMap,
          emp.enrollId,
          emp.fullName,
          lastEmployee.department,
          r + 2,
          punches,
        );
        r += 1;
      }
      continue;
    }

    if (lastEmployee && colMap.length && rowLooksLikePunchRow(row) && !parseEmployeeHeader(row)) {
      ingestPunchRow(
        row,
        colMap,
        lastEmployee.enrollId,
        lastEmployee.fullName,
        lastEmployee.department || currentDept || undefined,
        r + 1,
        punches,
      );
    }
  }

  punches.sort((a, b) => a.punch_at.localeCompare(b.punch_at));
  let from: string | null = range?.from.toISOString().slice(0, 10) ?? null;
  let to: string | null = range?.to.toISOString().slice(0, 10) ?? null;
  if (!from && punches.length) {
    from = punches[0].punch_at.slice(0, 10);
    to = punches[punches.length - 1].punch_at.slice(0, 10);
  }

  return {
    format: "zkteco-monthly-matrix",
    punches,
    errors,
    dateRange: { from, to },
  };
}

/** Reference layout matching ZKTeco "Attendance Record Report" export. */
export function buildZktecoAttendanceRecordTemplate(referenceMonth: string): unknown[][] {
  const [y, m] = referenceMonth.split("-").map(Number);
  const start = new Date(y, m - 1, 1);
  const end = new Date(y, m, 0);
  const fromStr = `${y}-${String(m).padStart(2, "0")}-01`;
  const toStr = `${y}-${String(m).padStart(2, "0")}-${String(end.getDate()).padStart(2, "0")}`;
  const daysInMonth = end.getDate();
  const dows = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
  const dowRow: string[] = [];
  const dayRow: (string | number)[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const dt = new Date(y, m - 1, d);
    dowRow.push(dows[(dt.getDay() + 6) % 7]);
    dayRow.push(d);
  }
  return [
    ["Attendance Record Report"],
    ["Att. Time", `${fromStr} ~ ${toStr}`],
    dowRow,
    dayRow,
    ["ID: 101 Name: Jane Doe Dept.: Reception"],
    dayRow.map((d, i) =>
      i === 0 ? "08:0218:05" : i === 1 ? "07:5518:10" : "",
    ),
    ["ID: 102 Name: John Smith Dept.: Housekeeping"],
    dayRow.map((d, i) => (i === 0 ? "18:3006:45" : "")),
  ];
}

/* -------------------------------------------------------------------------- */
/*  FALLBACK: simple daily / punch-log formats                                */
/* -------------------------------------------------------------------------- */

const STAFF_ALIASES = [
  "staff id", "employee id", "emp id", "user id", "enroll no", "enroll number",
  "enrollment no", "badge", "pin", "personnel id", "id no", "empno", "emp no",
  "ac no", "account id", "userid",
];
const DATE_ALIASES = ["date", "work date", "attendance date", "punch date"];
const TIME_ALIASES = ["time", "punch time", "clock time"];
const DATETIME_ALIASES = ["datetime", "date time", "timestamp", "punch datetime", "check time"];
const IN_ALIASES = ["time in", "check in", "clock in", "in time", "in", "checkin", "timein"];
const OUT_ALIASES = ["time out", "check out", "clock out", "out time", "out", "checkout", "timeout"];
const TYPE_ALIASES = ["state", "type", "status", "punch type", "io", "check type", "verify mode"];

const matchHeader = (h: string[], a: string[]) =>
  h.findIndex((x) => a.some((k) => x === k || x.includes(k)));

function parseDateTime(dateVal: unknown, timeVal?: unknown): string | null {
  if (typeof dateVal === "number" && dateVal > 30000) {
    const ms = (dateVal - 25569) * 86400 * 1000;
    const d = new Date(ms);
    if (timeVal != null && timeVal !== "") {
      if (typeof timeVal === "number" && timeVal < 1) {
        d.setHours(0, 0, 0, 0);
        d.setSeconds(Math.round(timeVal * 86400));
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
      const h = Math.floor(sec / 3600);
      const m = Math.floor((sec % 3600) / 60);
      const sc = sec % 60;
      tStr = `${h}:${String(m).padStart(2, "0")}:${String(sc).padStart(2, "0")}`;
    }
    const d = new Date(`${s}T${tStr.length <= 5 ? tStr + ":00" : tStr}`);
    if (!isNaN(d.getTime())) return d.toISOString();
    const dm = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (dm) {
      const d2 = new Date(`${dm[3]}-${dm[2].padStart(2, "0")}-${dm[1].padStart(2, "0")}T${tStr}`);
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
  if (aoa.length < 2) {
    return { format: "empty", punches, errors: [{ row: 0, error: "Empty sheet" }], dateRange: { from: null, to: null } };
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
    const iso =
      format === "zkteco-datetime"
        ? parseDateTime(row[dtCol])
        : parseDateTime(row[dateCol], timeCol >= 0 ? row[timeCol] : undefined);
    if (!iso) {
      errors.push({ row: rn, staff_id: staffId, error: "Invalid date/time" });
      continue;
    }
    const pType: "IN" | "OUT" =
      (typeCol >= 0 ? inferType(row[typeCol]) : null) ??
      (punches.filter((p) => p.staff_id === staffId && p.punch_at.slice(0, 10) === iso.slice(0, 10)).length % 2 === 0
        ? "IN"
        : "OUT");
    punches.push({ row: rn, staff_id: staffId, punch_at: iso, punch_type: pType, source: "BIOMETRIC" });
  }

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

export function parseBiometricSheet(aoa: unknown[][], options?: ParseBiometricOptions): ParseResult {
  if (isZktecoMatrix(aoa)) return parseZktecoMatrix(aoa, options);
  return parseFallback(aoa);
}

export type EmployeeLite = {
  id: string;
  staff_id: string;
  biometric_enroll_id?: string | null;
  full_name?: string;
  department_names?: string[];
};

const tokenize = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().split(/\s+/).filter(Boolean);

function deptMatches(punchDept: string | undefined, employeeDepts: string[] | undefined): boolean {
  if (!punchDept?.trim()) return true;
  if (!employeeDepts?.length) return true;
  const p = punchDept.toLowerCase();
  return employeeDepts.some(
    (d) => d.includes(p) || p.includes(d) || tokenize(d).some((t) => tokenize(p).includes(t)),
  );
}

function filterEmployeesByDepartment(employees: EmployeeLite[], departmentName?: string): EmployeeLite[] {
  if (!departmentName?.trim()) return employees;
  const filtered = employees.filter((e) => deptMatches(departmentName, e.department_names));
  return filtered.length ? filtered : employees;
}

function fuzzyMatchByName(name: string, employees: EmployeeLite[]): string | null {
  const t = tokenize(name);
  if (!t.length) return null;
  let best: { id: string; score: number } | null = null;
  for (const e of employees) {
    const et = tokenize(e.full_name || "");
    if (!et.length) continue;
    let score = 0;
    for (const tk of t) {
      if (et.includes(tk)) score += 2;
      else if (et.some((w) => w.startsWith(tk) || tk.startsWith(w))) score += 1;
    }
    if (!best || score > best.score) best = { id: e.id, score };
  }
  if (!best || best.score < 2) return null;
  const tied = employees.filter((e) => {
    const et = tokenize(e.full_name || "");
    let s = 0;
    for (const tk of t) {
      if (et.includes(tk)) s += 2;
      else if (et.some((w) => w.startsWith(tk) || tk.startsWith(w))) s += 1;
    }
    return s === best!.score;
  });
  return tied.length === 1 ? best.id : null;
}

export function matchPunchesToEmployees(
  punches: ParsedPunch[],
  employees: EmployeeLite[],
): { matched: ParsedPunch[]; unmatched: ParseError[] } {
  const byKey = new Map<string, string>();
  for (const e of employees) {
    byKey.set(e.staff_id.trim().toUpperCase(), e.id);
    if (e.biometric_enroll_id) byKey.set(e.biometric_enroll_id.trim().toUpperCase(), e.id);
  }

  const matched: ParsedPunch[] = [];
  const unmatched: ParseError[] = [];

  const metaByEnroll = new Map<string, { full_name?: string; department_name?: string }>();
  for (const p of punches) {
    const cur = metaByEnroll.get(p.staff_id) || {};
    if (p.full_name) cur.full_name = p.full_name;
    if (p.department_name) cur.department_name = p.department_name;
    metaByEnroll.set(p.staff_id, cur);
  }

  for (const p of punches) {
    let empId = byKey.get(p.staff_id.trim().toUpperCase());
    if (!empId) {
      const meta = metaByEnroll.get(p.staff_id);
      const pool = filterEmployeesByDepartment(employees, meta?.department_name || p.department_name);
      const name = meta?.full_name || p.full_name;
      if (name) {
        const exact = pool.find((e) => (e.full_name || "").trim().toUpperCase() === name.trim().toUpperCase());
        empId = exact?.id ?? fuzzyMatchByName(name, pool) ?? undefined;
      }
    }
    if (empId) matched.push({ ...p, employee_id: empId });
    else {
      const meta = metaByEnroll.get(p.staff_id);
      unmatched.push({
        row: p.row,
        staff_id: p.staff_id,
        error: `Enroll ID "${p.staff_id}"${meta?.full_name ? ` (${meta.full_name})` : ""}${
          meta?.department_name ? ` · ${meta.department_name}` : ""
        } not mapped — set Biometric Enroll ID on the staff profile`,
      });
    }
  }
  return { matched, unmatched };
}

export type EnrollSuggestion = {
  enroll_id: string;
  name?: string;
  department?: string;
  count: number;
  suggestions: { employee_id: string; full_name: string; score: number }[];
};

export function summarizeUnmatched(
  unmatched: ParseError[],
  employees: EmployeeLite[],
  punches: ParsedPunch[],
): EnrollSuggestion[] {
  const deptByEnroll = new Map<string, string>();
  const nameByEnroll = new Map<string, string>();
  for (const p of punches) {
    if (p.full_name) nameByEnroll.set(p.staff_id, p.full_name);
    if (p.department_name) deptByEnroll.set(p.staff_id, p.department_name);
  }

  const byId = new Map<string, { name?: string; department?: string; count: number }>();
  for (const u of unmatched) {
    if (!u.staff_id) continue;
    const m = u.error.match(/Enroll ID "[^"]+" \(([^)]+)\)/);
    const cur = byId.get(u.staff_id) || {
      name: nameByEnroll.get(u.staff_id) || m?.[1],
      department: deptByEnroll.get(u.staff_id),
      count: 0,
    };
    cur.count++;
    if (!cur.name && m?.[1]) cur.name = m[1];
    byId.set(u.staff_id, cur);
  }
  const out: EnrollSuggestion[] = [];
  for (const [enroll_id, info] of byId) {
    const pool = filterEmployeesByDepartment(employees, info.department);
    const t = tokenize(info.name || "");
    const suggs = pool
      .map((e) => {
        const et = tokenize(e.full_name || "");
        let score = 0;
        for (const tk of t) {
          if (et.includes(tk)) score += 2;
          else if (et.some((w) => w.startsWith(tk) || tk.startsWith(w))) score += 1;
        }
        if (info.department && deptMatches(info.department, e.department_names)) score += 3;
        return { employee_id: e.id, full_name: e.full_name || "", score };
      })
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
    out.push({
      enroll_id,
      name: info.name,
      department: info.department,
      count: info.count,
      suggestions: suggs,
    });
  }
  return out.sort((a, b) => b.count - a.count);
}

export const SUPPORTED_FORMATS = [
  {
    name: "ZKTeco Attendance Record Report (default)",
    columns: 'Title row · optional "Att. Time" range · weekday + day rows · "ID: … Name: … Dept.: …" + punch row',
  },
  { name: "Legacy punch log", columns: "User ID | Name | DateTime | State (Check In/Out)" },
  { name: "Daily summary", columns: "Staff ID | Date | Time In | Time Out" },
];
