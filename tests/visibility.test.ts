import { describe, expect, it } from "vitest";
import { isVisibleToStudent, statusLabel, statusColor } from "../lib/visibility";

const published = {
  status: "PUBLISHED" as const,
  visibleFrom: null,
  visibleTo: null,
  allowedGroups: [] as string[],
};

const draft = { ...published, status: "DRAFT" as const };
const archived = { ...published, status: "ARCHIVED" as const };

describe("isVisibleToStudent", () => {
  it("returns true for a published set with no restrictions", () => {
    expect(isVisibleToStudent(published, ["MO"])).toBe(true);
  });

  it("returns false for a draft set", () => {
    expect(isVisibleToStudent(draft, ["MO"])).toBe(false);
  });

  it("returns false for an archived set", () => {
    expect(isVisibleToStudent(archived, ["MO"])).toBe(false);
  });

  it("returns false if visibleFrom is in the future", () => {
    const future = new Date(Date.now() + 86_400_000);
    const set = { ...published, visibleFrom: future };
    expect(isVisibleToStudent(set, ["MO"])).toBe(false);
  });

  it("returns true if visibleFrom is in the past", () => {
    const past = new Date(Date.now() - 86_400_000);
    const set = { ...published, visibleFrom: past };
    expect(isVisibleToStudent(set, ["MO"])).toBe(true);
  });

  it("returns false if visibleTo is in the past", () => {
    const past = new Date(Date.now() - 86_400_000);
    const set = { ...published, visibleTo: past };
    expect(isVisibleToStudent(set, ["MO"])).toBe(false);
  });

  it("returns true if visibleTo is in the future", () => {
    const future = new Date(Date.now() + 86_400_000);
    const set = { ...published, visibleTo: future };
    expect(isVisibleToStudent(set, ["MO"])).toBe(true);
  });

  it("returns true when user group matches allowedGroups", () => {
    const set = { ...published, allowedGroups: ["MO", "PD"] };
    expect(isVisibleToStudent(set, ["MO"])).toBe(true);
  });

  it("returns false when user group does not match allowedGroups", () => {
    const set = { ...published, allowedGroups: ["PD"] };
    expect(isVisibleToStudent(set, ["MO"])).toBe(false);
  });

  it("returns true when allowedGroups is empty (open to all)", () => {
    const set = { ...published, allowedGroups: [] };
    expect(isVisibleToStudent(set, ["MO"])).toBe(true);
  });
});

describe("statusLabel", () => {
  it("returns Draft for draft sets", () => {
    expect(statusLabel(draft)).toBe("Draft");
  });

  it("returns Published for published sets", () => {
    expect(statusLabel(published)).toBe("Published");
  });

  it("returns Archived for archived sets", () => {
    expect(statusLabel(archived)).toBe("Archived");
  });

  it("returns Scheduled for published sets with future visibleFrom", () => {
    const future = new Date(Date.now() + 86_400_000);
    const set = { ...published, visibleFrom: future };
    expect(statusLabel(set)).toBe("Scheduled");
  });
});

describe("statusColor", () => {
  it("returns status-not-started for drafts", () => {
    expect(statusColor(draft)).toBe("status-not-started");
  });

  it("returns status-solved for published", () => {
    expect(statusColor(published)).toBe("status-solved");
  });

  it("returns status-review for archived", () => {
    expect(statusColor(archived)).toBe("status-review");
  });

  it("returns status-attempted for scheduled", () => {
    const future = new Date(Date.now() + 86_400_000);
    const set = { ...published, visibleFrom: future };
    expect(statusColor(set)).toBe("status-attempted");
  });
});
