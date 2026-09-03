# Grading Rules

The grading engine is deterministic and stores both the raw answer and the normalized answer.

## Answer Types

- `exact`: string comparison after trimming and spacing normalization.
- `integer`: integer numeric comparison.
- `decimal`: decimal numeric comparison with tolerance.
- `fraction`: rational equivalence, so `3/6` equals `1/2`.
  - Accepts `x/y`, `\frac{x}{y}`, `\dfrac{x}{y}`, and `\tfrac{x}{y}`.
  - When a problem explicitly requests a mixed number, `5 1/3` and `5\frac{1}{3}` normalize to `16/3`.
- `set`: unordered collection of values. `1, 2` is equivalent to `2; 1`. Useful for problems with multiple answers.
- `multiple`: any answer in the list of `acceptedAnswers` is correct (e.g., choice A or B).
- `multiple_choice`: two to 20 visible options; the exact, case-sensitive stored option selected by the student
  is graded. Choices may contain LaTeX and safe problem image tokens. This is distinct
  from `multiple`, which is a free-response field with alternative accepted answers.
- `expression`: numeric evaluation. The system calculates the numeric value of the `answerKey` and compares it to the value of the student's input.
  - **Equivalency:** `0.5` matches `1/2`. `sqrt(2)` matches `2^0.5`.
  - **Implicit Math:** `2pi`, `3(4+1)`, and `5sqrt2` are recognized as multiplication.
  - **Roots:** Square roots accept `sqrt(2)`, `sqrt2`, `\sqrt{2}`, and `\sqrt2`. Cube and indexed roots accept `cbrt(8)`, `sqrt[3](8)`, and `\sqrt[3]{8}`.
  - **Functions:** Supports `sin`, `cos`, `tan`, `ln`, `log`, etc.

## Alcumus-Style Numeric Input

The numeric expression grammar follows the common [AoPS Alcumus formatting conventions](https://artofproblemsolving.com/school/handbook/current/alcumus): slash or LaTeX fractions, `pi`, caret powers, implicit coefficients, scientific notation, and grouped roots. DBSMO additionally accepts the convenient ungrouped forms `sqrt2`, `cbrt8`, and `\sqrt2`; these are bounded, deterministic extensions rather than documented Alcumus syntax.

Root shorthand consumes one numeric or constant atom. Therefore `sqrt12` means `sqrt(12)`, while a compound radicand must be grouped as `sqrt(1+2)`. General functions remain explicit, such as `sin(pi/2)`; ambiguous forms such as `sin30` are rejected. Conventional exponent precedence applies: `-2^2` is `-(2^2)`, while `(-2)^2` is positive.

The grader uses a fixed token grammar and a whitelist of functions. It does not call JavaScript `eval`, execute LaTeX, accept unknown commands, or treat unknown variables as numeric values (sources: `lib/math-input.ts`, `lib/grading.ts`).

## Normalization

- Trim leading and trailing whitespace.
- Collapse repeated whitespace.
- Normalize case unless the problem is case-sensitive.
- Preserve the original raw answer in the response record.
- Normalize equivalent fractions for `fraction` answers.
- Sort unordered values for `set` answers.

## Regrading

When an admin edits an answer key or accepted answers, the system should:

1. Create an audit record.
2. Regrade affected responses.
3. Update attempt totals.
4. Notify students if a score changed.
