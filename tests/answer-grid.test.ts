import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AnswerGrid } from "../app/problem-sets/[slug]/answer-grid";

describe("AnswerGrid", () => {
  it("keeps inline problems visible while locking solved submissions", () => {
    const html = renderToStaticMarkup(
      React.createElement(AnswerGrid, {
        problemSetId: "set-1",
        problemNumbers: [1],
        lockedAttemptNumber: 1,
        problemSummaries: [
          {
            number: 1,
            statement: "Solve $x+1=2$.",
            topicTags: ["Algebra"],
            explanationNote: null,
            contentFormat: "LATEX",
          },
        ],
      }),
    );

    expect(html).toContain("Solve ");
    expect(html).toContain("Attempt #1 solved this set, so submissions are locked.");
    expect(html).toContain("Submission locked");
    expect(html).not.toContain("Submit set");
    expect(html).not.toContain("Enter answer");
  });
});
