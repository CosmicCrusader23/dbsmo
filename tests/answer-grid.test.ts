import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AnswerGrid, buildTestQuestionRows } from "../app/problem-sets/[slug]/answer-grid";

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

  it("groups test sets as 20 problems with three answer levels", () => {
    const problemNumbers = Array.from({ length: 60 }, (_, index) => index + 1);
    const rows = buildTestQuestionRows(problemNumbers);

    expect(rows).toHaveLength(20);
    expect(rows[0].cells.map((cell) => cell.label)).toEqual(["1(1)", "1(2)", "1(3)"]);
    expect(rows[19].cells.map((cell) => cell.label)).toEqual(["20(1)", "20(2)", "20(3)"]);

    const html = renderToStaticMarkup(
      React.createElement(AnswerGrid, {
        problemSetId: "test-set",
        problemNumbers,
        answerLayout: "test",
      }),
    );

    expect(html).toContain("Test answer sheet");
    expect(html).toContain("20 problems · 3 levels · 60 marks");
    expect(html).toContain('href="#problem-1"');
    expect(html).toContain('id="problem-60"');
    expect(html).toContain('aria-label="Answer 1(1)"');
    expect(html).toContain('aria-label="Answer 20(3)"');
  });
});
