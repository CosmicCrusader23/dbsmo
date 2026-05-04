import { describe, expect, it } from "vitest";
import { getFilePath } from "../lib/storage";

describe("getFilePath", () => {
  it("resolves normal storage keys", () => {
    expect(getFilePath("imports/set/problems.pdf")).toContain("storage/imports/set/problems.pdf");
  });

  it("rejects storage keys that escape the storage root", () => {
    expect(() => getFilePath("../outside.pdf")).toThrow("Storage key must stay inside");
  });
});
