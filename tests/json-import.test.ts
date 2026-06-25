import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import { createProblemSetJsonDraft, dryRunProblemSetJson } from "../lib/import/json-import";
import { parseImageZip } from "../lib/import/image-zip";

const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
  "base64",
);

async function imageZip(files: Record<string, Buffer>) {
  const zip = new JSZip();
  for (const [name, buffer] of Object.entries(files)) {
    zip.file(name, buffer);
  }
  return Buffer.from(await zip.generateAsync({ type: "nodebuffer" }));
}

describe("dryRunProblemSetJson", () => {
  it("validates inline LaTeX statements, answer types, and solutions", async () => {
    const text = JSON.stringify({
      slug: "json-latex-smoke",
      title: "JSON LaTeX Smoke",
      status: "DRAFT",
      topicTags: ["Algebra"],
      problems: [
        {
          number: 1,
          statement: "Find $x$ if $x^2=4$.",
          answerType: "INTEGER",
          answerKey: "2",
          acceptedAnswers: ["-2"],
          solution: "$x=\\pm 2$.",
        },
      ],
    });

    const result = await dryRunProblemSetJson({
      fileName: "json-latex-smoke.json",
      sizeBytes: Buffer.byteLength(text),
      text,
    });

    expect(result.ok).toBe(true);
    expect(result.preview?.problemCount).toBe(1);
    expect(result.preview?.answerTypeCounts.INTEGER).toBe(1);
    expect(result.preview?.solutionCount).toBe(1);
  });

  it("rejects slugs that are unsafe for problem-set URLs", async () => {
    const text = JSON.stringify({
      slug: "../draft-set",
      title: "Bad Slug",
      problems: [{ answerKey: "1" }],
    });

    const result = await dryRunProblemSetJson({
      fileName: "bad-slug.json",
      sizeBytes: Buffer.byteLength(text),
      text,
    });

    expect(result.ok).toBe(false);
    expect(result.issues.some((issue) => issue.message.includes("Slug must use"))).toBe(true);
  });

  it("requires JSON problem numbers to be integers, not string IDs", async () => {
    const text = JSON.stringify({
      slug: "json-string-question-id",
      title: "String Question ID",
      problems: [{ number: "1", answerKey: "1" }],
    });

    const result = await dryRunProblemSetJson({
      fileName: "json-string-question-id.json",
      sizeBytes: Buffer.byteLength(text),
      text,
    });

    expect(result.ok).toBe(false);
    expect(result.issues.some((issue) => issue.message.includes("number"))).toBe(true);
  });

  it("accepts problem image references from a same-name image ZIP", async () => {
    const text = JSON.stringify({
      slug: "json-geometry-image",
      title: "JSON Geometry Image",
      problems: [
        {
          number: 1,
          statement: "Find the shaded area.",
          imageRef: "geomnumber1.png",
          answerType: "INTEGER",
          answerKey: "12",
        },
      ],
    });
    const buffer = await imageZip({ "images/geomnumber1.png": PNG_1X1 });

    const result = await dryRunProblemSetJson({
      fileName: "json-geometry-image.json",
      sizeBytes: Buffer.byteLength(text),
      text,
      imageZip: {
        fileName: "json-geometry-image.zip",
        sizeBytes: buffer.byteLength,
        buffer,
      },
    });

    expect(result.ok).toBe(true);
    expect(result.preview?.imageCount).toBe(1);
  });

  it("rejects problem image references without a supplied image", async () => {
    const text = JSON.stringify({
      slug: "json-missing-image",
      title: "JSON Missing Image",
      problems: [{ statement: "Use the diagram.", imageRef: "diagram.png", answerKey: "1" }],
    });

    const result = await dryRunProblemSetJson({
      fileName: "json-missing-image.json",
      sizeBytes: Buffer.byteLength(text),
      text,
    });

    expect(result.ok).toBe(false);
    expect(result.issues.some((issue) => issue.message.includes("no matching image"))).toBe(true);
  });
});

describe("createProblemSetJsonDraft", () => {
  it("builds an editable draft even when validation errors exist", async () => {
    const text = JSON.stringify({
      slug: "json-draft-missing-answer",
      title: "JSON Draft Missing Answer",
      description: "Needs one answer filled in from the editor.",
      status: "DRAFT",
      topicTags: ["Algebra"],
      problems: [
        {
          number: 1,
          statement: "Compute $5+6$.",
          answerType: "INTEGER",
          points: 1,
          solution: "Add the integers.",
        },
        {
          number: 2,
          statement: "Compute $8+1$.",
          answerType: "INTEGER",
          answerKey: "9",
          points: 1,
        },
      ],
    });

    const result = await createProblemSetJsonDraft({
      fileName: "json-draft-missing-answer.json",
      sizeBytes: Buffer.byteLength(text),
      text,
    });

    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ message: "Problem 1 is missing answerKey." }),
      ]),
    );
    expect(result.draft).not.toBeNull();
    expect(result.draft?.fileName).toBe("json-draft-missing-answer.json");
    expect(result.draft?.title).toBe("JSON Draft Missing Answer");
    expect(result.draft?.problems).toHaveLength(2);
    expect(result.draft?.problems[0]).toEqual(
      expect.objectContaining({
        number: 1,
        statement: "Compute $5+6$.",
        answerKey: "",
        answerType: "INTEGER",
        explanationNote: "Add the integers.",
      }),
    );
    expect(result.draft?.problems[1]).toEqual(
      expect.objectContaining({
        number: 2,
        answerKey: "9",
      }),
    );
  });

  it("opens a draft for string problem numbers so the editor can fix them", async () => {
    const text = JSON.stringify({
      slug: "json-string-number-draft",
      title: "String Number Draft",
      problems: [{ number: "1", statement: "Compute $1+1$.", answerKey: "2" }],
    });

    const result = await createProblemSetJsonDraft({
      fileName: "json-string-number-draft.json",
      sizeBytes: Buffer.byteLength(text),
      text,
    });

    expect(result.ok).toBe(false);
    expect(result.draft?.problems[0].number).toBe(1);
    expect(result.issues.some((issue) => issue.message.includes("number"))).toBe(true);
  });
});

describe("parseImageZip", () => {
  it("rejects unsafe image ZIP paths", async () => {
    const buffer = await imageZip({ "../evil.png": PNG_1X1 });

    const result = await parseImageZip({
      fileName: "geometry.zip",
      sizeBytes: buffer.byteLength,
      buffer,
    });

    expect(result.ok).toBe(false);
    expect(result.issues.some((issue) => issue.message.includes("unsafe path"))).toBe(true);
  });
});
