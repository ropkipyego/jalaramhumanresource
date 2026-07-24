import type { ShiftCode } from "@/types/database";

export type ParsedShiftCode =
  | { kind: "ok"; code: ShiftCode; startTime: string | null; label: string }
  | { kind: "empty" }
  | { kind: "invalid" };

const VALID: ShiftCode[] = ["D", "N", "OFF", "PH"];

/** Parse "D 9AM", "D 6:30AM", "D", "N", "OFF", "PH" without breaking plain clinical codes. */
export function parseShiftCell(raw: unknown): ParsedShiftCode {
  if (raw === null || raw === undefined) return { kind: "empty" };
  const original = String(raw).trim();
  if (!original || original === "-" || original === "—") return { kind: "empty" };

  const upper = original.toUpperCase().replace(/\s+/g, " ").trim();
  const compact = upper.replace(/\s+/g, "");

  if (VALID.includes(compact as ShiftCode)) {
    return { kind: "ok", code: compact as ShiftCode, startTime: null, label: compact };
  }

  // Aliases without time
  if (["DAY", "AM", "MORNING", "M"].includes(compact)) {
    return { kind: "ok", code: "D", startTime: null, label: "D" };
  }
  if (["NIGHT", "PM", "EVENING", "NGT"].includes(compact)) {
    return { kind: "ok", code: "N", startTime: null, label: "N" };
  }
  if (["REST", "O", "X", "RESTDAY", "LEAVE", "L", "A"].includes(compact)) {
    return { kind: "ok", code: "OFF", startTime: null, label: "OFF" };
  }
  if (["HOLIDAY", "HOL", "H"].includes(compact)) {
    return { kind: "ok", code: "PH", startTime: null, label: "PH" };
  }
  if (["D/N", "DN", "N/D", "ND"].includes(compact)) {
    return { kind: "ok", code: "D", startTime: null, label: "D" };
  }

  // Timed day: "D 9AM", "D 6:30AM", "D9AM", "9AM", "06:30", "D 09:00"
  const timed = upper.match(
    /^(?:D[\s-]*)?(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?$/i
  );
  if (timed) {
    let hour = Number(timed[1]);
    const minute = timed[2] ? Number(timed[2]) : 0;
    const meridiem = (timed[3] || "").toUpperCase();
    if (meridiem === "PM" && hour < 12) hour += 12;
    if (meridiem === "AM" && hour === 12) hour = 0;
    if (hour > 23 || minute > 59) return { kind: "invalid" };
    // Bare evening times without D → treat as night if >= 18
    if (!upper.startsWith("D") && !meridiem && hour >= 18) {
      const startTime = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
      return { kind: "ok", code: "N", startTime, label: `N ${formatLabel(hour, minute)}` };
    }
    const startTime = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
    return {
      kind: "ok",
      code: "D",
      startTime,
      label: `D ${formatLabel(hour, minute)}`,
    };
  }

  // "N 6:30PM" style
  const nightTimed = upper.match(/^N[\s-]*(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?$/i);
  if (nightTimed) {
    let hour = Number(nightTimed[1]);
    const minute = nightTimed[2] ? Number(nightTimed[2]) : 0;
    const meridiem = (nightTimed[3] || "").toUpperCase();
    if (meridiem === "PM" && hour < 12) hour += 12;
    if (meridiem === "AM" && hour === 12) hour = 0;
    if (hour > 23 || minute > 59) return { kind: "invalid" };
    const startTime = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
    return { kind: "ok", code: "N", startTime, label: `N ${formatLabel(hour, minute)}` };
  }

  return { kind: "invalid" };
}

function formatLabel(hour: number, minute: number): string {
  const h12 = hour % 12 || 12;
  const ampm = hour < 12 ? "AM" : "PM";
  return minute === 0 ? `${h12}${ampm}` : `${h12}:${String(minute).padStart(2, "0")}${ampm}`;
}

export type ShiftTemplateRow = {
  id: string;
  code: string;
  name: string;
  start_time: string;
  end_time: string;
  department_id: string | null;
  is_active: boolean;
};

/** Match HH:MM to a shift template (prefer department-specific). */
export function matchShiftTemplate(
  templates: ShiftTemplateRow[],
  departmentId: string | null | undefined,
  startTime: string | null,
  shiftCode: ShiftCode
): string | null {
  if (!startTime || shiftCode === "OFF" || shiftCode === "PH") return null;
  const want = toMinutes(startTime);
  if (want == null) return null;

  const active = templates.filter((t) => t.is_active !== false);
  const dept = departmentId
    ? active.filter((t) => t.department_id === departmentId)
    : [];
  const pool = dept.length ? dept : active.filter((t) => !t.department_id);

  let best: { id: string; dist: number } | null = null;
  for (const t of pool) {
    const st = String(t.start_time).slice(0, 5);
    const mins = toMinutes(st);
    if (mins == null) continue;
    const dist = Math.abs(mins - want);
    if (dist <= 15 && (!best || dist < best.dist)) {
      best = { id: t.id, dist };
    }
  }
  return best?.id ?? null;
}

function toMinutes(hhmm: string): number | null {
  const m = hhmm.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}
