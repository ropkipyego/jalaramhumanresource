import { describe, it, expect } from "vitest";
import {
  runAttendanceEngine,
  processEmployee,
  dedupePunches,
  pairPunches,
  roundOvertime,
  DEFAULT_SETTINGS,
  type EngineShift,
  type EnginePunch,
} from "@/lib/attendanceEngine";

const EMP = "emp-1";

function shift(partial: Partial<EngineShift> & { id: string; shift_date: string }): EngineShift {
  return {
    employee_id: EMP,
    shift_code: "DAY",
    sequence: 1,
    scheduled_start: `${partial.shift_date}T08:00:00.000Z`,
    scheduled_end: `${partial.shift_date}T17:00:00.000Z`,
    ...partial,
  } as EngineShift;
}

function punch(id: string, at: string): EnginePunch {
  return { id, employee_id: EMP, punch_at: at };
}

describe("attendanceEngine — helpers", () => {
  it("dedupes punches inside the duplicate window", () => {
    const { kept, removed } = dedupePunches(
      [punch("a", "2026-07-01T08:00:00.000Z"), punch("b", "2026-07-01T08:00:30.000Z")],
      60,
    );
    expect(kept).toHaveLength(1);
    expect(removed).toHaveLength(1);
  });

  it("pairs punches by alternation and flags an unpaired IN", () => {
    const odd = pairPunches([
      punch("a", "2026-07-01T08:00:00.000Z"),
      punch("b", "2026-07-01T17:00:00.000Z"),
      punch("c", "2026-07-01T18:00:00.000Z"),
    ]);
    expect(odd.workedMinutes).toBe(540);
    expect(odd.unpairedIn).toBe(true);
  });

  it("only pays overtime above the minimum, rounded down", () => {
    expect(roundOvertime(20, DEFAULT_SETTINGS)).toBe(0);
    expect(roundOvertime(44, DEFAULT_SETTINGS)).toBe(30);
    expect(roundOvertime(9999, DEFAULT_SETTINGS)).toBe(DEFAULT_SETTINGS.maxDailyOtMin);
  });
});

describe("attendanceEngine — shift outcomes", () => {
  it("marks a clean shift PRESENT with no overtime", () => {
    const [r] = processEmployee(EMP, [shift({ id: "s1", shift_date: "2026-07-01" })], [
      punch("a", "2026-07-01T08:00:00.000Z"),
      punch("b", "2026-07-01T17:00:00.000Z"),
    ]);
    expect(r.status).toBe("PRESENT");
    expect(r.worked_minutes).toBe(540);
    expect(r.overtime_minutes).toBe(0);
    expect(r.late_minutes).toBe(0);
  });

  it("flags lateness beyond the threshold", () => {
    const [r] = processEmployee(EMP, [shift({ id: "s1", shift_date: "2026-07-01" })], [
      punch("a", "2026-07-01T08:25:00.000Z"),
      punch("b", "2026-07-01T17:00:00.000Z"),
    ]);
    expect(r.status).toBe("LATE");
    expect(r.late_minutes).toBe(20); // 25 min late minus 5 min grace
  });

  it("ignores lateness inside grace", () => {
    const [r] = processEmployee(EMP, [shift({ id: "s1", shift_date: "2026-07-01" })], [
      punch("a", "2026-07-01T08:04:00.000Z"),
      punch("b", "2026-07-01T17:00:00.000Z"),
    ]);
    expect(r.late_minutes).toBe(0);
    expect(r.status).toBe("PRESENT");
  });

  it("flags early departure", () => {
    const [r] = processEmployee(EMP, [shift({ id: "s1", shift_date: "2026-07-01" })], [
      punch("a", "2026-07-01T08:00:00.000Z"),
      punch("b", "2026-07-01T16:00:00.000Z"),
    ]);
    expect(r.status).toBe("EARLY_DEPARTURE");
    expect(r.early_departure_minutes).toBe(55);
  });

  it("calculates overtime and queues it for approval", () => {
    const [r] = processEmployee(EMP, [shift({ id: "s1", shift_date: "2026-07-01" })], [
      punch("a", "2026-07-01T08:00:00.000Z"),
      punch("b", "2026-07-01T19:05:00.000Z"),
    ]);
    expect(r.status).toBe("OVERTIME");
    expect(r.overtime_minutes).toBe(120); // 125 raw, rounded down to 15-min blocks
    expect(r.overtime_status).toBe("PENDING_APPROVAL");
  });

  it("handles a night shift that crosses midnight and keeps it on the start date", () => {
    const night = shift({
      id: "n1",
      shift_date: "2026-07-01",
      shift_code: "NIGHT",
      crosses_midnight: true,
      scheduled_start: "2026-07-01T19:00:00.000Z",
      scheduled_end: "2026-07-02T07:00:00.000Z",
    });
    const [r] = processEmployee(EMP, [night], [
      punch("a", "2026-07-01T18:55:00.000Z"),
      punch("b", "2026-07-02T07:02:00.000Z"),
    ]);
    expect(r.shift_date).toBe("2026-07-01");
    expect(r.status).toBe("PRESENT");
    expect(r.worked_minutes).toBe(727);
  });

  it("supports two shifts on the same day without mixing punches", () => {
    const day = shift({ id: "d1", shift_date: "2026-07-01", shift_code: "DAY", sequence: 1 });
    const evening = shift({
      id: "e1",
      shift_date: "2026-07-01",
      shift_code: "NIGHT",
      sequence: 2,
      scheduled_start: "2026-07-01T19:00:00.000Z",
      scheduled_end: "2026-07-02T03:00:00.000Z",
    });
    const results = processEmployee(EMP, [day, evening], [
      punch("a", "2026-07-01T08:00:00.000Z"),
      punch("b", "2026-07-01T17:00:00.000Z"),
      punch("c", "2026-07-01T19:00:00.000Z"),
      punch("d", "2026-07-02T03:00:00.000Z"),
    ]);
    expect(results).toHaveLength(2);
    expect(results[0].matched_punch_ids).toEqual(["a", "b"]);
    expect(results[1].matched_punch_ids).toEqual(["c", "d"]);
    expect(results.every((r) => r.status === "PRESENT")).toBe(true);
  });

  it("flags a missing OUT punch and pays no overtime for it", () => {
    const [r] = processEmployee(EMP, [shift({ id: "s1", shift_date: "2026-07-01" })], [
      punch("a", "2026-07-01T08:00:00.000Z"),
    ]);
    expect(r.status).toBe("MISSING_OUT");
    expect(r.overtime_minutes).toBe(0);
    expect(r.anomalies).toContain("MISSING_OUT");
  });

  it("flags a scheduled shift with no punches at all", () => {
    const [r] = processEmployee(EMP, [shift({ id: "s1", shift_date: "2026-07-01" })], []);
    expect(r.status).toBe("NO_PUNCHES");
    expect(r.anomaly_code).toBe("NO_PUNCHES");
  });

  it("treats OFF days as non-working and never as absence", () => {
    const off = shift({ id: "o1", shift_date: "2026-07-01", shift_code: "OFF", non_working: true });
    const [r] = processEmployee(EMP, [off], []);
    expect(r.status).toBe("OFF");
  });

  it("flags implausible durations and refuses to pay them", () => {
    const [r] = processEmployee(EMP, [shift({ id: "s1", shift_date: "2026-07-01" })], [
      punch("a", "2026-07-01T05:00:00.000Z"),
      punch("b", "2026-07-01T23:30:00.000Z"),
    ]);
    expect(r.status).toBe("ANOMALY");
    expect(r.anomalies).toContain("IMPLAUSIBLE_DURATION");
    expect(r.worked_minutes).toBe(0);
    expect(r.overtime_minutes).toBe(0);
  });

  it("records punches with no matching shift as unscheduled work", () => {
    const results = processEmployee(EMP, [], [
      punch("a", "2026-07-05T09:00:00.000Z"),
      punch("b", "2026-07-05T13:00:00.000Z"),
    ]);
    expect(results).toHaveLength(1);
    expect(results[0].shift_type).toBe("UNSCHEDULED");
    expect(results[0].anomaly_code).toBe("UNSCHEDULED_WORK");
    expect(results[0].overtime_minutes).toBe(0);
  });

  it("is deterministic and idempotent for the same input", () => {
    const input = {
      shifts: [shift({ id: "s1", shift_date: "2026-07-01" })],
      punches: [punch("a", "2026-07-01T08:10:00.000Z"), punch("b", "2026-07-01T18:00:00.000Z")],
    };
    expect(runAttendanceEngine(input)).toEqual(runAttendanceEngine(input));
  });

  it("processes multiple employees independently", () => {
    const other: EnginePunch = { id: "x", employee_id: "emp-2", punch_at: "2026-07-01T08:00:00.000Z" };
    const results = runAttendanceEngine({
      shifts: [
        shift({ id: "s1", shift_date: "2026-07-01" }),
        { ...shift({ id: "s2", shift_date: "2026-07-01" }), employee_id: "emp-2" },
      ],
      punches: [punch("a", "2026-07-01T08:00:00.000Z"), punch("b", "2026-07-01T17:00:00.000Z"), other],
    });
    expect(results).toHaveLength(2);
    expect(results.find((r) => r.employee_id === "emp-2")!.status).toBe("MISSING_OUT");
  });
});
