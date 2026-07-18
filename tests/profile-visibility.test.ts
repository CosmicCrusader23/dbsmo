import { describe, expect, it } from "vitest";
import { canLinkProblemSetFromProfile } from "../lib/profile-visibility";

const now = new Date();
const published = {
  status: "PUBLISHED" as const,
  visibleFrom: new Date(now.getTime() - 60_000),
  visibleTo: new Date(now.getTime() + 60_000),
};

describe("profile problem-set links", () => {
  it("shows currently visible sets to students", () => {
    expect(canLinkProblemSetFromProfile(published, "STUDENT")).toBe(true);
  });

  it.each([
    { ...published, status: "DRAFT" as const },
    { ...published, status: "ARCHIVED" as const },
    { ...published, visibleFrom: new Date(now.getTime() + 60_000) },
    { ...published, visibleTo: new Date(now.getTime() - 60_000) },
  ])("hides unavailable sets from public profile links", (set) => {
    expect(canLinkProblemSetFromProfile(set, "STUDENT")).toBe(false);
    expect(canLinkProblemSetFromProfile(set, "CONTENT_EDITOR")).toBe(false);
  });

  it("keeps hidden-set links available to admins", () => {
    expect(canLinkProblemSetFromProfile({ ...published, status: "DRAFT" }, "ADMIN")).toBe(true);
  });
});
