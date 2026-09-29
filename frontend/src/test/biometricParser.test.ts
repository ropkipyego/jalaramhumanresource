import { describe, it, expect } from "vitest";
import {
  parseBiometricSheet,
  matchPunchesToEmployees,
  inferReferenceMonthFromFileName,
  buildZktecoAttendanceRecordTemplate,
} from "@/lib/biometricParser";

describe("biometricParser", () => {
  it("parses ZKTeco Attendance Record Report matrix (hospital export shape)", () => {
    const aoa = [
      ["Attendance Record Report"],
      ["FRI", "Sat", "Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
      [14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29],
      ["ID: 18 Name: Maina"],
      ["18:29", "09:3018:22", "09:0718:08", "", "07:0618:14", "", "", "", "", "", "", "", "", "", "", ""],
    ];
    const result = parseBiometricSheet(aoa, { referenceMonth: "2026-08" });
    expect(result.format).toBe("zkteco-monthly-matrix");
    expect(result.punches.length).toBeGreaterThan(0);
    expect(result.punches[0].staff_id).toBe("18");
    expect(result.punches[0].full_name).toBe("Maina");
    expect(result.punches[0].punch_at.startsWith("2026-08-14")).toBe(true);
  });

  it("infers month from payroll filename", () => {
    expect(inferReferenceMonthFromFileName("PAYROLL_AUGUST_BIOMETRICS_2026.xlsx")).toBe("2026-08");
  });

  it("builds default Attendance Record Report template", () => {
    const aoa = buildZktecoAttendanceRecordTemplate("2026-08");
    expect(String(aoa[0][0])).toContain("Attendance Record Report");
    const parsed = parseBiometricSheet(aoa);
    expect(parsed.format).toBe("zkteco-monthly-matrix");
    expect(parsed.punches.length).toBeGreaterThan(0);
  });

  it("parses ZKTeco datetime format (legacy punch log)", () => {
    const aoa = [
      ["User ID", "Name", "DateTime", "State"],
      ["EMP-001", "Jane", "2026-07-01 08:02:00", "Check In"],
      ["EMP-001", "Jane", "2026-07-01 18:05:00", "Check Out"],
    ];
    const result = parseBiometricSheet(aoa);
    expect(result.format).toBe("zkteco-datetime");
    expect(result.punches).toHaveLength(2);
  });

  it("matches staff primarily by biometric enroll ID", () => {
    const punches = [
      {
        row: 2,
        staff_id: "18",
        full_name: "Maina",
        punch_at: "2026-08-14T08:00:00.000Z",
        punch_type: "IN" as const,
        source: "BIOMETRIC" as const,
      },
    ];
    const { matched, unmatched } = matchPunchesToEmployees(punches, [
      { id: "uuid-1", staff_id: "EMP-001", biometric_enroll_id: "18", full_name: "Maina W.", department_names: ["reception"] },
    ]);
    expect(matched).toHaveLength(1);
    expect(matched[0].employee_id).toBe("uuid-1");
    expect(unmatched).toHaveLength(0);
  });

  it("uses department + name when enroll ID not mapped", () => {
    const punches = [
      {
        row: 2,
        staff_id: "99",
        full_name: "Jane Doe",
        department_name: "Reception",
        punch_at: "2026-08-01T08:00:00.000Z",
        punch_type: "IN" as const,
        source: "BIOMETRIC" as const,
      },
    ];
    const { matched } = matchPunchesToEmployees(punches, [
      { id: "uuid-1", staff_id: "EMP-001", biometric_enroll_id: null, full_name: "Jane Doe", department_names: ["reception"] },
      { id: "uuid-2", staff_id: "EMP-002", biometric_enroll_id: null, full_name: "Jane Doe", department_names: ["lab"] },
    ]);
    expect(matched[0].employee_id).toBe("uuid-1");
  });
});
