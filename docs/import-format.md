# JSON Import Format

Admins can upload a JSON file to create a full problem set in one import. The importer validates the file before saving anything.

This format now supports two different kinds of tags:

- Top-level `topicTags`: tags for the whole problem set.
- Per-problem `topicTags`: optional question tags. These are the tags used by Practice mode.

Practice mode only shows tags that belong to more than 10 published questions.

## Example

```json
{
  "slug": "mo-set-001",
  "title": "MO Set 001 - Algebra Basics",
  "description": "Introductory answer-only algebra practice.",
  "statementFormat": "LATEX",
  "order": "1",
  "status": "PUBLISHED",
  "topicTags": ["algebra", "starter"],
  "difficulty": 2,
  "videoUrl": "https://example.com/video",
  "problems": [
    {
      "number": "1",
      "statement": "Solve for x: 2x = 4",
      "answerType": "integer",
      "answerKey": "2",
      "points": 1,
      "topicTags": ["algebra", "linear-equations"]
    },
    {
      "number": "2",
      "statement": "Give the exact value of sqrt(2).",
      "answerType": "expression",
      "answerKey": "sqrt(2)",
      "acceptedAnswers": ["2^0.5"],
      "topicTags": ["surds"]
    },
    {
      "number": "3",
      "statement": "State the parity of 17.",
      "answerType": "exact",
      "answerKey": "odd"
    }
  ]
}
```

In the example above:

- the set is tagged with `algebra` and `starter`
- question 1 contributes to Practice pools for `algebra` and `linear-equations`
- question 2 contributes to the `surds` Practice pool
- question 3 has no question tags, so it does not contribute to a Practice tag pool

## Top-Level Fields

| Field | Type | Required | Default | Notes |
| :--- | :--- | :--- | :--- | :--- |
| `slug` | string | Yes | - | Unique URL-friendly identifier, e.g. `algebra-01`. |
| `title` | string | Yes | - | Display name of the set. |
| `description` | string | No | `""` | Optional set description. |
| `statementFormat` | string | No | `"LATEX"` | Statement format for all problems unless overridden per problem. One of `"LATEX"` or `"HTML"`. |
| `order` | string | No | next free order | Controls sort order. Supports any string value (sorted by ASCII). If omitted or empty, the system assigns the next available numeric order. Integer values are also accepted and coerced to strings. |
| `status` | string | No | `"DRAFT"` | One of `"DRAFT"`, `"PUBLISHED"`, `"ARCHIVED"`. |
| `visibleFrom` | ISO datetime string | No | `null` | Set release time. |
| `visibleTo` | ISO datetime string | No | `null` | Set close time. |
| `topicTags` | string[] | No | `[]` | Tags for the set as a whole. These do not by themselves place questions into Practice pools. |
| `difficulty` | integer | No | `1` | Difficulty from 1 to 10. |
| `videoUrl` | URL string | No | `null` | Optional video link. |
| `problems` | object[] | Yes | - | At least one problem is required. |

## Problem Fields

Each entry in `problems` defines one question.

| Field | Type | Required | Default | Notes |
| :--- | :--- | :--- | :--- | :--- |
| `number` | string | No | array index + 1 | Question identifier. Supports alphanumeric values like `"1"`, `"1a"`, `"A1"`, `"Q3b"`. Integer values are also accepted and coerced to strings. Ordered by ASCII value. |
| `statement` | string | No | `""` | Problem statement. LaTeX is allowed. |
| `statementFormat` | string | No | inherits top-level `statementFormat` | One of `"LATEX"` or `"HTML"`. Use `"HTML"` for content containing tags like `<math>...</math>`. |
| `answerKey` | string | Yes* | - | Primary correct answer. |
| `answer` | string | Yes* | - | Alias for `answerKey`. |
| `answerType` | string | No | `"EXACT"` | One of `"EXACT"`, `"INTEGER"`, `"DECIMAL"`, `"FRACTION"`, `"SET"`, `"MULTIPLE"`, `"EXPRESSION"`. Lowercase values are also accepted by the importer. |
| `acceptedAnswers` | string[] or string | No | `[]` | Alternative correct answers. A string value may use `;` as a separator. |
| `caseSensitive` | boolean | No | `false` | Enables case-sensitive grading. |
| `points` | integer | No | `1` | Points awarded for the problem. |
| `topicTags` | string[] | No | `[]` | Optional question tags. These are the tags used by Practice mode. |
| `solution` | string | No | `null` | Optional explanation shown after completion. |
| `explanationNote` | string | No | `null` | Alias for `solution`. |

\* Each problem must provide either `answerKey` or `answer`.

## Statement Format

- `LATEX` (default): the statement is interpreted as normal text with LaTeX delimiters (`$...$`, `$$...$$`, `\(...\)`, `\[...\]`).
- `HTML`: the renderer accepts HTML-like source and converts `<math>...</math>`, `<imath>...</imath>`, and `<cmath>...</cmath>` math tags to KaTeX output.

## Practice Tag Behavior

Per-problem `topicTags` drive Practice mode.

- A question can have zero, one, or many question tags.
- If a question has no `topicTags`, it will not appear in a Practice tag pool.
- Practice mode only considers questions from published sets.
- A tag only appears in the Practice tab when more than 10 published questions use that tag.

## Answer Evaluation Rules

- `EXACT`: normalized string match
- `INTEGER`: integer normalization
- `DECIMAL`: decimal normalization
- `FRACTION`: simplified fraction comparison
- `SET`: order-insensitive set comparison
- `MULTIPLE`: exact string grading with additional accepted answers
- `EXPRESSION`: numeric expression evaluation

### Notes

- Fraction answers like `2/4` are simplified to `1/2`.
- `FRACTION` does not automatically treat `1/2` and `0.5` as equal. Use `EXPRESSION` if decimal and fractional forms should both pass.
- `EXPRESSION` supports inputs like `sqrt(2)`, `2^0.5`, `pi/3`, `2pi`, and `3(1+2)`.
- `EXPRESSION` is numeric only. Symbolic algebra such as `x+1` is not supported.

## Validation Rules

- File size limit: 5 MB
- The uploaded file must be valid JSON.
- Duplicate problem numbers (IDs) are rejected.
- Problem IDs can be any non-empty string — letters, digits, or a mix (e.g. `"1a"`, `"A1"`, `"Q3b"`).
- When problem IDs are omitted, they default to `"1"`, `"2"`, `"3"`, etc.
- Problems are sorted by ASCII value of their ID string.
- Each problem must include an answer.
- Invalid answer types are rejected.
