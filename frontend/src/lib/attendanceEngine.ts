/**
 * AttendanceEngine — pure, deterministic biometric attendance calculation.
 *
 * No React, no network, no Supabase. Given scheduled shifts + raw punches it
 * returns one attendance result per shift (plus unscheduled-work results).
 * Runs server-side (edge function) and is unit-tested directly.
 *
 * Pipeline: normalise → match punches to shifts → pair IN/OUT → compute
 * minutes → classify status → detect anomalies → overtime.
 */

export const ENGINE_VERSION = "v1";

export type EnginePunch = {
  id: string;
  employee_id: string;
  punch_at: string; // ISO
  punch_type?: "IN" | "OUT" | null;
};

export type EngineShift = {
  id: string;
  employee_id: string;
  department_id?: string | null;
  shift_date: string; // YYYY-MM-DD
  shift_code: string;
  sequence?: number;
  scheduled_start: string | null; // ISO
  scheduled_end: string | null; // ISO
  crosses_midnight?: boolean;
  grace_before_min?: number | null;
  grace_after_min?: number | null;
  meal_break_minutes?: number | null;
  paid_break?: boolean | null;
  min_ot_minutes?: number | null;
  ot_round_minutes?: number | null;
  /** OFF / leave / holiday days are not expected to have punches */
  non_working?: boolean;
};

export type EngineSettings = {
  /** how long before scheduled start a punch may still belong to the shift */
  matchWindowBeforeMin: number;
  /** how long after scheduled end a punch may still belong to the shift */
  matchWindowAfterMin: number;
  lateThresholdMin: number;
  graceMin: number;
  minOtMin: number;
  otRoundMin: number;
  maxDailyOtMin: number;
  /** duplicate suppression window */
  duplicateWindowSec: number;
  /** anything longer than this is implausible and flagged, never paid */
  maxShiftMinutes: number;
};

export const DEFAULT_SETTINGS: EngineSettings = {
  matchWindowBeforeMin: 240,
  matchWindowAfterMin: 240,
  lateThresholdMin: 10,
  graceMin: 5,
  minOtMin: 30,
  otRoundMin: 15,
  maxDailyOtMin: 240,
  duplicateWindowSec: 60,
  maxShiftMinutes: 16 * 60,
};

export type AnomalyCode =
  | "MISSING_IN"
  | "MISSING_OUT"
  | "NO_PUNCHES"
  | "DUPLICATE_PUNCH"
  | "UNSCHEDULED_WORK"
  | "IMPLAUSIBLE_DURATION"
  | "OUT_BEFORE_IN"
  | "SHORT_SHIFT"
  | "OVERLAPPING_SHIFTS";

export type AttendanceStatus =
  | "PRESENT"
  | "LATE"
  | "EARLY_DEPARTURE"
  | "OVERTIME"
  | "MISSING_IN"
  | "MISSING_OUT"
  | "NO_PUNCHES"
  | "ANOMALY"
  | "OFF";

export type EngineResult = {
  employee_id: string;
  department_id: string | null;
  shift_instance_id: string | null;
  shift_date: string;
  shift_type: string;
  sequence: number;
  scheduled_start: string | null;
  scheduled_end: string | null;
  actual_start: string | null;
  actual_end: string | null;
  scheduled_minutes: number;
  worked_minutes: number;
  late_minutes: number;
  early_departure_minutes: number;
  overtime_minutes: number;
  overtime_status: "NONE" | "PENDING_APPROVAL";
  status: AttendanceStatus;
  anomaly_code: AnomalyCode | null;
  anomalies: AnomalyCode[];
  matched_punch_ids: string[];
  intervals: { in: string; out: string | null; minutes: number }[];
};

const ms = (iso: string) => new Date(iso).getTime();
const minutesBetween = (a: number, b: number) => Math.round((b - a) / 60000);
const iso = (t: number) => new Date(t).toISOString();

/** Remove punches that repeat within the duplicate window. */
export function dedupePunches(
  punches: EnginePunch[],
  windowSec: number,
): { kept: EnginePunch[]; removed: EnginePunch[] } {
  const sorted = [...punches].sort((a, b) => ms(a.punch_at) - ms(b.punch_at));
  const kept: EnginePunch[] = [];
  const removed: EnginePunch[] = [];
  for (const p of sorted) {
    const prev = kept[kept.length - 1];
    if (prev && Math.abs(ms(p.punch_at) - ms(prev.punch_at)) <= windowSec * 1000) {
      removed.push(p);
    } else {
      kept.push(p);
    }
  }
  return { kept, removed };
}

type Window = { shift: EngineShift; from: number; to: number; start: number; end: number };

function shiftWindow(shift: EngineShift, s: EngineSettings): Window | null {
  if (!shift.scheduled_start || !shift.scheduled_end) return null;
  const start = ms(shift.scheduled_start);
  const end = ms(shift.scheduled_end);
  return {
    shift,
    start,
    end,
    from: start - s.matchWindowBeforeMin * 60000,
    to: end + s.matchWindowAfterMin * 60000,
  };
}

/** Distance from a punch to a shift window (0 when inside the scheduled span). */
function distance(t: number, w: Window): number {
  if (t < w.start) return w.start - t;
  if (t > w.end) return t - w.end;
  return 0;
}

/**
 * Assign each punch to the nearest shift whose match window contains it.
 * Punches outside every window become unscheduled work.
 */
export function matchPunchesToShifts(
  punches: EnginePunch[],
  shifts: EngineShift[],
  settings: EngineSettings = DEFAULT_SETTINGS,
): { byShift: Map<string, EnginePunch[]>; unmatched: EnginePunch[] } {
  const windows = shifts
    .map((sh) => shiftWindow(sh, settings))
    .filter((w): w is Window => w !== null && !w.shift.non_working);
  const byShift = new Map<string, EnginePunch[]>();
  for (const sh of shifts) byShift.set(sh.id, []);
  const unmatched: EnginePunch[] = [];

  for (const p of punches) {
    const t = ms(p.punch_at);
    let best: Window | null = null;
    let bestDist = Number.POSITIVE_INFINITY;
    for (const w of windows) {
      if (t < w.from || t > w.to) continue;
      const d = distance(t, w);
      if (d < bestDist) {
        bestDist = d;
        best = w;
      }
    }
    if (best) byShift.get(best.shift.id)!.push(p);
    else unmatched.push(p);
  }
  return { byShift, unmatched };
}

/** Pair punches into IN/OUT intervals by alternation (device state is unreliable). */
export function pairPunches(punches: EnginePunch[]): {
  intervals: { in: string; out: string | null; minutes: number }[];
  workedMinutes: number;
  unpairedIn: boolean;
} {
  const sorted = [...punches].sort((a, b) => ms(a.punch_at) - ms(b.punch_at));
  const intervals: { in: string; out: string | null; minutes: number }[] = [];
  let worked = 0;
  for (let i = 0; i < sorted.length; i += 2) {
    const inP = sorted[i];
    const outP = sorted[i + 1];
    if (!outP) {
      intervals.push({ in: inP.punch_at, out: null, minutes: 0 });
      return { intervals, workedMinutes: worked, unpairedIn: true };
    }
    const m = Math.max(0, minutesBetween(ms(inP.punch_at), ms(outP.punch_at)));
    worked += m;
    intervals.push({ in: inP.punch_at, out: outP.punch_at, minutes: m });
  }
  return { intervals, workedMinutes: worked, unpairedIn: false };
}

export function roundOvertime(raw: number, s: EngineSettings, shift?: EngineShift): number {
  const minOt = shift?.min_ot_minutes ?? s.minOtMin;
  const round = shift?.ot_round_minutes ?? s.otRoundMin;
  if (raw < minOt) return 0;
  const rounded = round > 0 ? Math.floor(raw / round) * round : raw;
  return Math.min(rounded, s.maxDailyOtMin);
}

function buildResult(
  shift: EngineShift,
  punches: EnginePunch[],
  settings: EngineSettings,
  extraAnomalies: AnomalyCode[],
): EngineResult {
  const anomalies: AnomalyCode[] = [...extraAnomalies];
  const start = shift.scheduled_start ? ms(shift.scheduled_start) : null;
  const end = shift.scheduled_end ? ms(shift.scheduled_end) : null;
  const scheduledMinutes = start !== null && end !== null ? minutesBetween(start, end) : 0;

  const base: EngineResult = {
    employee_id: shift.employee_id,
    department_id: shift.department_id ?? null,
    shift_instance_id: shift.id,
    shift_date: shift.shift_date,
    shift_type: shift.shift_code,
    sequence: shift.sequence ?? 1,
    scheduled_start: shift.scheduled_start,
    scheduled_end: shift.scheduled_end,
    actual_start: null,
    actual_end: null,
    scheduled_minutes: scheduledMinutes,
    worked_minutes: 0,
    late_minutes: 0,
    early_departure_minutes: 0,
    overtime_minutes: 0,
    overtime_status: "NONE",
    status: "NO_PUNCHES",
    anomaly_code: null,
    anomalies,
    matched_punch_ids: [],
    intervals: [],
  };

  if (shift.non_working) {
    return { ...base, status: "OFF", anomalies, anomaly_code: anomalies[0] ?? null };
  }

  if (punches.length === 0) {
    anomalies.push("NO_PUNCHES");
    return { ...base, status: "NO_PUNCHES", anomalies, anomaly_code: "NO_PUNCHES" };
  }

  const { intervals, workedMinutes, unpairedIn } = pairPunches(punches);
  const sorted = [...punches].sort((a, b) => ms(a.punch_at) - ms(b.punch_at));
  const actualStart = ms(sorted[0].punch_at);
  const actualEnd = ms(sorted[sorted.length - 1].punch_at);

  let worked = workedMinutes;
  const breakMin = shift.meal_break_minutes ?? 0;
  if (!shift.paid_break && breakMin > 0 && worked > breakMin) worked -= breakMin;

  const graceBefore = shift.grace_before_min ?? settings.graceMin;
  const graceAfter = shift.grace_after_min ?? settings.graceMin;

  let late = 0;
  let early = 0;
  if (start !== null) late = Math.max(0, minutesBetween(start, actualStart) - graceBefore);
  if (end !== null && !unpairedIn) early = Math.max(0, minutesBetween(actualEnd, end) - graceAfter);

  if (unpairedIn) anomalies.push("MISSING_OUT");
  if (worked > settings.maxShiftMinutes) anomalies.push("IMPLAUSIBLE_DURATION");
  if (!unpairedIn && scheduledMinutes > 0 && worked > 0 && worked < scheduledMinutes / 2)
    anomalies.push("SHORT_SHIFT");

  const implausible = anomalies.includes("IMPLAUSIBLE_DURATION");
  const rawOt = implausible || unpairedIn ? 0 : Math.max(0, worked - scheduledMinutes);
  const overtime = roundOvertime(rawOt, settings, shift);

  let status: AttendanceStatus;
  if (implausible) status = "ANOMALY";
  else if (unpairedIn) status = "MISSING_OUT";
  else if (late > settings.lateThresholdMin) status = "LATE";
  else if (early > 0) status = "EARLY_DEPARTURE";
  else if (overtime > 0) status = "OVERTIME";
  else status = "PRESENT";

  return {
    ...base,
    actual_start: iso(actualStart),
    actual_end: unpairedIn ? null : iso(actualEnd),
    worked_minutes: implausible ? 0 : worked,
    late_minutes: late,
    early_departure_minutes: early,
    overtime_minutes: overtime,
    overtime_status: overtime > 0 ? "PENDING_APPROVAL" : "NONE",
    status,
    anomalies,
    anomaly_code: anomalies[0] ?? null,
    matched_punch_ids: sorted.map((p) => p.id),
    intervals,
  };
}

function unscheduledResult(
  employeeId: string,
  punches: EnginePunch[],
  settings: EngineSettings,
): EngineResult[] {
  // group unmatched punches by calendar date of the first punch
  const byDate = new Map<string, EnginePunch[]>();
  for (const p of punches) {
    const d = p.punch_at.slice(0, 10);
    if (!byDate.has(d)) byDate.set(d, []);
    byDate.get(d)!.push(p);
  }
  const out: EngineResult[] = [];
  for (const [date, list] of byDate) {
    const { intervals, workedMinutes, unpairedIn } = pairPunches(list);
    const sorted = [...list].sort((a, b) => ms(a.punch_at) - ms(b.punch_at));
    const anomalies: AnomalyCode[] = ["UNSCHEDULED_WORK"];
    if (unpairedIn) anomalies.push("MISSING_OUT");
    if (workedMinutes > settings.maxShiftMinutes) anomalies.push("IMPLAUSIBLE_DURATION");
    out.push({
      employee_id: employeeId,
      department_id: null,
      shift_instance_id: null,
      shift_date: date,
      shift_type: "UNSCHEDULED",
      sequence: 1,
      scheduled_start: null,
      scheduled_end: null,
      actual_start: sorted[0].punch_at,
      actual_end: unpairedIn ? null : sorted[sorted.length - 1].punch_at,
      scheduled_minutes: 0,
      worked_minutes: anomalies.includes("IMPLAUSIBLE_DURATION") ? 0 : workedMinutes,
      late_minutes: 0,
      early_departure_minutes: 0,
      // unscheduled time is never auto-paid as OT — it must be reviewed
      overtime_minutes: 0,
      overtime_status: "NONE",
      status: "ANOMALY",
      anomaly_code: "UNSCHEDULED_WORK",
      anomalies,
      matched_punch_ids: sorted.map((p) => p.id),
      intervals,
    });
  }
  return out;
}

/**
 * Process one employee's shifts and punches for a period.
 * Deterministic: same inputs always produce the same results.
 */
export function processEmployee(
  employeeId: string,
  shifts: EngineShift[],
  punches: EnginePunch[],
  settings: EngineSettings = DEFAULT_SETTINGS,
): EngineResult[] {
  const { kept, removed } = dedupePunches(punches, settings.duplicateWindowSec);
  const orderedShifts = [...shifts].sort((a, b) => {
    const at = a.scheduled_start ? ms(a.scheduled_start) : ms(`${a.shift_date}T00:00:00Z`);
    const bt = b.scheduled_start ? ms(b.scheduled_start) : ms(`${b.shift_date}T00:00:00Z`);
    return at - bt || (a.sequence ?? 1) - (b.sequence ?? 1);
  });

  const { byShift, unmatched } = matchPunchesToShifts(kept, orderedShifts, settings);

  const results: EngineResult[] = [];
  for (const shift of orderedShifts) {
    const shiftPunches = byShift.get(shift.id) ?? [];
    const extra: AnomalyCode[] = [];
    if (removed.some((r) => shiftPunches.some((p) => Math.abs(ms(p.punch_at) - ms(r.punch_at)) <= settings.duplicateWindowSec * 1000)))
      extra.push("DUPLICATE_PUNCH");
    results.push(buildResult(shift, shiftPunches, settings, extra));
  }
  results.push(...unscheduledResult(employeeId, unmatched, settings));
  return results;
}

export type EngineInput = {
  shifts: EngineShift[];
  punches: EnginePunch[];
  settings?: Partial<EngineSettings>;
};

/** Process a whole period for many employees. */
export function runAttendanceEngine(input: EngineInput): EngineResult[] {
  const settings = { ...DEFAULT_SETTINGS, ...(input.settings ?? {}) };
  const employees = new Set<string>([
    ...input.shifts.map((s) => s.employee_id),
    ...input.punches.map((p) => p.employee_id),
  ]);
  const out: EngineResult[] = [];
  for (const emp of employees) {
    out.push(
      ...processEmployee(
        emp,
        input.shifts.filter((s) => s.employee_id === emp),
        input.punches.filter((p) => p.employee_id === emp),
        settings,
      ),
    );
  }
  return out.sort(
    (a, b) =>
      a.employee_id.localeCompare(b.employee_id) ||
      a.shift_date.localeCompare(b.shift_date) ||
      a.sequence - b.sequence,
  );
}
