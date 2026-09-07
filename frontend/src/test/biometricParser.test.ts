import { describe, it, expect } from "vitest";
import { parseBiometricSheet, matchPunchesToEmployees } from "@/lib/biometricParser";

describe("biometricParser", () => {
  it("parses ZKTeco datetime format", () => {
    const aoa = [
      ["User ID", "Name", "DateTime", "State"],
      ["EMP-001", "Jane", "2026-07-01 08:02:00", "Check In"],
      ["EMP-001", "Jane", "2026-07-01 18:05:00", "Check Out"],
    ];
    const result = parseBiometricSheet(aoa);
    expect(result.format).toBe("zkteco-datetime");
    expect(result.punches).toHaveLength(2);
    expect(result.punches[0].staff_id).toBe("EMP-001");
    expect(result.punches[0].punch_type).toBe("IN");
    expect(result.punches[1].punch_type).toBe("OUT");
  });

  it("parses daily in/out format", () => {
    const aoa = [
      ["Staff ID", "Date", "Time In", "Time Out"],
      ["EMP-002", "2026-07-01", "08:00", "17:30"],
    ];
    const result = parseBiometricSheet(aoa);
    expect(result.format).toBe("daily-in-out");
    expect(result.punches).toHaveLength(2);
    expect(result.punches[0].punch_type).toBe("IN");
    expect(result.punches[1].punch_type).toBe("OUT");
  });

  it("matches staff by staff_id and biometric_enroll_id", () => {
    const punches = [
      { row: 2, staff_id: "1001", punch_at: "2026-07-01T08:00:00Z", punch_type: "IN" as const, source: "BIOMETRIC" as const },
    ];
    const { matched, unmatched } = matchPunchesToEmployees(punches, [
      { id: "uuid-1", staff_id: "EMP-001", biometric_enroll_id: "1001" },
    ]);
    expect(matched).toHaveLength(1);
    expect(matched[0].employee_id).toBe("uuid-1");
    expect(unmatched).toHaveLength(0);
  });

  it("reports unknown staff", () => {
    const punches = [
      { row: 2, staff_id: "UNKNOWN", punch_at: "2026-07-01T08:00:00Z", punch_type: "IN" as const, source: "BIOMETRIC" as const },
    ];
    const { unmatched } = matchPunchesToEmployees(punches, [
      { id: "uuid-1", staff_id: "EMP-001", biometric_enroll_id: null },
    ]);
    expect(unmatched).toHaveLength(1);
  });
});
