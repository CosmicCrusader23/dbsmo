import type { AnswerType, ProblemContentFormat, ProblemSetStatus } from "@prisma/client";

type ExportableProblemSet = {
  slug: string;
  title: string;
  description: string;
  order: string;
  status: ProblemSetStatus;
  visibleFrom: Date | null;
  visibleTo: Date | null;
  topicTags: string[];
  difficulty: number;
  videoUrl: string | null;
  problems: Array<{
    number: number;
    statement: string;
    contentFormat: ProblemContentFormat;
    answerKey: string;
    answerType: AnswerType;
    acceptedAnswers: string[];
    caseSensitive: boolean;
    topicTags: string[];
    points: number;
    explanationNote: string | null;
  }>;
};

export function problemSetToImportJson(set: ExportableProblemSet) {
  return {
    slug: set.slug,
    title: set.title,
    description: set.description,
    statementFormat: "LATEX",
    order: set.order,
    status: set.status,
    visibleFrom: set.visibleFrom?.toISOString() ?? null,
    visibleTo: set.visibleTo?.toISOString() ?? null,
    topicTags: set.topicTags,
    difficulty: set.difficulty,
    videoUrl: set.videoUrl,
    problems: set.problems.map((problem) => ({
      number: problem.number,
      statement: problem.statement,
      statementFormat: problem.contentFormat,
      answerType: problem.answerType,
      answerKey: problem.answerKey,
      acceptedAnswers: problem.acceptedAnswers,
      caseSensitive: problem.caseSensitive,
      topicTags: problem.topicTags,
      points: problem.points,
      solution: problem.explanationNote,
    })),
  };
}
