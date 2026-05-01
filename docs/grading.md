# Grading Rules

The grading engine is deterministic and stores both the raw answer and the normalized answer.

## Answer Types

- `exact`: string comparison after trimming and spacing normalization.
- `integer`: integer numeric comparison.
- `decimal`: decimal numeric comparison with tolerance.
- `fraction`: rational equivalence, so `3/6` equals `1/2`.
- `set`: unordered collection of values. `1, 2` is equivalent to `2; 1`. Useful for problems with multiple answers.
- `multiple`: any answer in the list of `acceptedAnswers` is correct (e.g., choice A or B).
- `expression`: numeric evaluation. The system calculates the numeric value of the `answerKey` and compares it to the value of the student's input.
  - **Equivalency:** `0.5` matches `1/2`. `sqrt(2)` matches `2^0.5`.
  - **Implicit Math:** `2pi` is recognized as `2 * pi`.
  - **Functions:** Supports `sin`, `cos`, `tan`, `ln`, `log`, etc.

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
