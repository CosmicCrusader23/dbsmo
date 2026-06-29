import { describe, expect, it } from "vitest";
import { displayNameFor, normalizeDisplayText } from "@/lib/display-name";

describe("display name normalization", () => {
  it("treats placeholder strings as empty names", () => {
    expect(normalizeDisplayText("null")).toBeNull();
    expect(normalizeDisplayText(" undefined ")).toBeNull();
    expect(displayNameFor({ displayName: "null", name: " Edwin ", email: "e@example.com" })).toBe(
      "Edwin",
    );
  });
});
