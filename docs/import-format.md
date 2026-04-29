# ZIP Import Format

Admins upload one ZIP per problem set. The import flow should run a dry validation before writing database records.

## Required Structure

```text
mo-set-001.zip
  manifest.yml
  problems.pdf
  solution.pdf
  answers.csv
  assets/
    diagram-01.png
```

## `manifest.yml`

```yaml
slug: mo-set-001
title: MO Set 001 - Algebra Basics
description: Introductory answer-only algebra practice.
order: 1
status: draft
allowedGroups:
  - MO
topicTags:
  - algebra
  - equations
difficulty: 2
problemFile: problems.pdf
solutionFile: solution.pdf
videoUrl: https://example.com/video
answersFile: answers.csv
```

## `answers.csv`

```csv
number,answerType,answer,acceptedAnswers,topicTags,points
1,integer,42,,algebra,1
2,fraction,3/7,"0.428571;3:7",number_theory,1
3,set,"1,2,5","{1,2,5};1 2 5",combinatorics,1
```

## Validation Rules

- `manifest.yml` must exist.
- `answers.csv` must exist.
- Referenced files must be inside the ZIP.
- Problem numbers must be unique.
- `slug` must be unique unless update mode is selected.
- `answerType` must be one of `exact`, `integer`, `decimal`, `fraction`, `set`, or `multiple`.
- Uploaded and decompressed sizes must stay within platform limits.
