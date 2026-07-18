import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import {
  ClientZipExpandedSizeLimitError,
  readClientZipEntryBounded,
} from "../lib/import/client-zip-entry";

describe("readClientZipEntryBounded", () => {
  it("returns browser-side ZIP bytes within the limit", async () => {
    const zip = new JSZip();
    zip.file("set.json", '{"title":"Safe"}');
    const entry = zip.file("set.json");

    await expect(readClientZipEntryBounded(entry!, 100, "too large")).resolves.toEqual(
      new TextEncoder().encode('{"title":"Safe"}'),
    );
  });

  it("stops inflation once actual bytes cross the limit", async () => {
    const zip = new JSZip();
    zip.file("bomb.json", "x".repeat(10_000));
    const entry = zip.file("bomb.json");

    await expect(readClientZipEntryBounded(entry!, 100, "expanded too far")).rejects.toEqual(
      expect.objectContaining({
        name: ClientZipExpandedSizeLimitError.name,
        message: "expanded too far",
      }),
    );
  });
});
