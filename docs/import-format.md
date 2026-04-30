# JSON Import Format

Admins can upload a JSON file to create a problem set and its associated problems in one go. The import flow performs a dry validation to catch errors before saving anything to the database.

## JSON Structure Overview

A valid import file contains a single JSON object with the problem set's metadata and an array of `problems`.

```json
{
  "slug": "mo-set-001",
  "title": "MO Set 001 - Algebra Basics",
  "description": "Introductory answer-only algebra practice.",
  "order": 1,
  "status": "PUBLISHED",
  "topicTags": ["algebra", "equations"],
  "difficulty": 2,
  "videoUrl": "https://example.com/video",
  "problems": [
    {
      "number": 1,
      "statement": "Solve for x: 2x = 4",
      "answerType": "integer",
      "answerKey": "2",
      "points": 1,
      "topicTags": ["algebra"]
    },
    {
      "number": 2,
      "statement": "What is 3 divided by 7?",
      "answerType": "fraction",
      "answerKey": "3/7",
      "acceptedAnswers": ["3:7", "0.428571"]
    }
  ]
}
```

## Problem Set Variables (Top-Level)

| Variable | Type | Required | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `slug` | String | **Yes** | - | A unique URL-friendly identifier for the set (e.g., `algebra-01`). |
| `title` | String | **Yes** | - | The display title of the problem set. |
| `description` | String | No | `""` | A brief explanation or instructions for the problem set. |
| `order` | Integer | No | `0` | Controls sorting on the main dashboard (lower numbers appear first). |
| `status` | String | No | `"DRAFT"` | Visibility status: `"DRAFT"`, `"PUBLISHED"`, or `"ARCHIVED"`. |
| `visibleFrom` | String (ISO Date) | No | `null` | When the set becomes accessible (e.g., `"2024-05-01T10:00:00Z"`). |
| `visibleTo` | String (ISO Date) | No | `null` | When the set closes and is no longer accessible. |
| `topicTags` | Array of Strings | No | `[]` | Categories applied to the whole set (e.g., `["algebra", "geometry"]`). |
| `difficulty` | Integer (1-10) | No | `1` | Estimated difficulty rating from 1 to 10. |
| `videoUrl` | String (URL) | No | `null` | A link to an explanatory video (e.g., YouTube). |
| `problems` | Array of Objects| **Yes** | - | A list of problem objects (see below). Must have at least 1 problem. |

## Problem Variables

Inside the `problems` array, each object defines a single question.

| Variable | Type | Required | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `number` | Integer | No | Array Index + 1 | The question number. If omitted, it automatically assigns sequential numbers starting from 1. |
| `statement` | String | No | `""` | The question text (supports LaTeX formatting). |
| `answerKey` (or `answer`) | String | **Yes** | - | The primary correct answer string. |
| `answerType` | String | No | `"EXACT"` | How the system grades the answer. Options: `"EXACT"`, `"INTEGER"`, `"DECIMAL"`, `"FRACTION"`, `"SET"`, `"MULTIPLE"`. |
| `acceptedAnswers`| Array/String | No | `[]` | Alternative correct answers. Can be an array of strings, or a single string separated by semicolons (`;`). |
| `caseSensitive` | Boolean | No | `false` | If `true`, the grading enforces exact capitalization matching. |
| `points` | Integer | No | `1` | How many points this problem is worth. |
| `topicTags` | Array of Strings | No | `[]` | Specific topics for this individual problem. |
| `solution` (or `explanationNote`) | String | No | `null` | A walkthrough or explanation shown to students after completion. |

## Notes on Validation
- **Size Limit:** The JSON file cannot exceed 5 MB.
- **Duplicate Numbers:** If two problems have the same `number`, the import will fail.
- **Answer Checking:** Every problem must have an `answerKey` (or `answer`), otherwise it will be rejected.
