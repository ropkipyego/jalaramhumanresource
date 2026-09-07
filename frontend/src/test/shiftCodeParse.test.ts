import { describe, it, expect } from "vitest";
import { parseShiftCell } from "@/lib/shiftCodeParse";

describe("shiftCodeParse", () => {
  it("parses plain shift codes", () => {
    expect(parseShiftCell("D").kind).toBe("ok");
    expect(parseShiftCell("N").kind).toBe("ok");
    expect(parseShiftCell("OFF").kind).toBe("ok");
    expect(parseShiftCell("PH").kind).toBe("ok");
  });

  it("parses aliases", () => {
    expect(parseShiftCell("DAY").kind).toBe("ok");
    expect(parseShiftCell("NIGHT").kind).toBe("ok");
    expect(parseShiftCell("REST").kind).toBe("ok");
    expect(parseShiftCell("HOLIDAY").kind).toBe("ok");
  });

  it("parses timed day shifts", () => {
    const r = parseShiftCell("D 9AM");
    expect(r.kind).toBe("ok");
    if (r.kind === "ok") {
      expect(r.code).toBe("D");
      expect(r.startTime).toBe("09:00");
    }
  });

  it("parses timed night shifts", () => {
    const r = parseShiftCell("N 6:30PM");
    expect(r.kind).toBe("ok");
    if (r.kind === "ok") {
      expect(r.code).toBe("N");
      expect(r.startTime).toBe("18:30");
    }
  });

  it("treats empty cells as empty", () => {
    expect(parseShiftCell("").kind).toBe("empty");
    expect(parseShiftCell("-").kind).toBe("empty");
  });

  it("rejects invalid codes", () => {
    expect(parseShiftCell("XYZ").kind).toBe("invalid");
  });
});
