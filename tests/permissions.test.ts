import { describe, expect, it } from "vitest";
import {
  canAccessAdminArea,
  canViewHiddenLeaderboardEntries,
  canViewPrivateProfiles,
} from "../lib/permissions";

describe("admin area middleware policy", () => {
  it.each(["ADMIN", "TEACHER", "CONTENT_EDITOR", "ANALYST"] as const)(
    "allows the documented %s staff role through the broad gate",
    (role) => {
      expect(canAccessAdminArea(role)).toBe(true);
    },
  );

  it.each(["STUDENT", "UNKNOWN", null, undefined])("rejects %s", (role) => {
    expect(canAccessAdminArea(role)).toBe(false);
  });
});

describe("privacy override permissions", () => {
  it("limits private profiles to user-management roles", () => {
    expect(canViewPrivateProfiles("ADMIN")).toBe(true);
    expect(canViewPrivateProfiles("TEACHER")).toBe(true);
    expect(canViewPrivateProfiles("ANALYST")).toBe(false);
    expect(canViewPrivateProfiles("CONTENT_EDITOR")).toBe(false);
    expect(canViewPrivateProfiles("STUDENT")).toBe(false);
  });

  it("limits hidden leaderboard entries to analytics roles", () => {
    expect(canViewHiddenLeaderboardEntries("ADMIN")).toBe(true);
    expect(canViewHiddenLeaderboardEntries("TEACHER")).toBe(true);
    expect(canViewHiddenLeaderboardEntries("ANALYST")).toBe(true);
    expect(canViewHiddenLeaderboardEntries("CONTENT_EDITOR")).toBe(false);
    expect(canViewHiddenLeaderboardEntries("STUDENT")).toBe(false);
  });
});
