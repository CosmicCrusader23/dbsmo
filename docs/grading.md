# Grading Rules

The grading engine is deterministic and stores both the raw answer and the normalized answer.

## Answer Types

- `exact`: string comparison after trimming and spacing normalization.
- `integer`: integer numeric comparison.
- `decimal`: decimal numeric comparison with tolerance.
- `fraction`: rational equivalence, so `3/6` equals `1/2`.
- `set`: unordered values, normalized and sorted.
- `multiple`: any accepted answer is correct.

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
