import { describe, expect, it } from "vitest";
import { dryRunProblemSetJson } from "../lib/import/json-import";

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
});
