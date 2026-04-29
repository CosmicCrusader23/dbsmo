import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { dryRunProblemSetZip } from "../lib/import/zip-dry-run";

describe("dryRunProblemSetZip", () => {
  it("parses the demo archive", async () => {
    const filePath = join(process.cwd(), "examples/mo-set-001.zip");
    const buffer = await readFile(filePath);
    const result = await dryRunProblemSetZip({
      fileName: "mo-set-001.zip",
      sizeBytes: buffer.byteLength,
      buffer,
    });

    expect(result.ok).toBe(true);
    expect(result.preview?.slug).toBe("mo-set-001");
    expect(result.preview?.problemCount).toBe(5);
    expect(result.preview?.answerTypeCounts.integer).toBe(1);
  });
});
