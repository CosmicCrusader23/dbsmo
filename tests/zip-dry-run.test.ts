import { readFile } from "node:fs/promises";
import { join } from "node:path";
import JSZip from "jszip";
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

  it("rejects ZIP entries that try to escape the archive root", async () => {
    const zip = new JSZip();
    zip.file(
      "manifest.yml",
      [
        "slug: unsafe-zip",
        "title: Unsafe ZIP",
        "order: 1",
        "problemFile: problems.pdf",
        "answersFile: answers.csv",
      ].join("\n"),
    );
    zip.file(
      "answers.csv",
      "number,answerType,answer,acceptedAnswers,topicTags,points\n1,integer,1,,,1\n",
    );
    zip.file("problems.pdf", "fake pdf");
    zip.file("../outside.pdf", "should not import");

    const buffer = Buffer.from(await zip.generateAsync({ type: "nodebuffer" }));
    const result = await dryRunProblemSetZip({
      fileName: "unsafe.zip",
      sizeBytes: buffer.byteLength,
      buffer,
    });

    expect(result.ok).toBe(false);
    expect(result.issues.some((issue) => issue.message.includes("unsafe path"))).toBe(true);
  });
});
