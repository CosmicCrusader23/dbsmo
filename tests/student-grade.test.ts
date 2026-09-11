import { describe, expect, it } from "vitest";
import { gradeFromStudentEmail, schoolYearLabel, schoolYearStartYear } from "@/lib/student-grade";

describe("student grade calculation", () => {
  it("calculates grade 11 for dbs22072000 during school year 2627", () => {
    const date = new Date("2026-09-12T00:00:00Z");
    expect(gradeFromStudentEmail("dbs22072000@g.dbs.edu.hk", date)).toBe(11);
    expect(schoolYearLabel(date)).toBe("2627");
  });

  it("keeps the previous grade until September 1 in Hong Kong time", () => {
    expect(schoolYearStartYear(new Date("2026-08-31T15:59:59Z"))).toBe(2025);
    expect(schoolYearStartYear(new Date("2026-08-31T16:00:00Z"))).toBe(2026);
  });

  it("ignores non-school and malformed student emails", () => {
    const date = new Date("2026-09-12T00:00:00Z");
    expect(gradeFromStudentEmail("dbs22072000@dbs.edu.hk", date)).toBeNull();
    expect(gradeFromStudentEmail("student@g.dbs.edu.hk", date)).toBeNull();
  });
});
