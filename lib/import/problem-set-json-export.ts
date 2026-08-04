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
    options: string[];
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
    problems: set.problems.map((problem) => {
      const multipleChoice = problem.answerType === "MULTIPLE_CHOICE";
      const correctOption = multipleChoice ? problem.options.indexOf(problem.answerKey) : -1;
      return {
        number: problem.number,
        statement: problem.statement,
        statementFormat: problem.contentFormat,
        answerType: problem.answerType,
        answerKey: multipleChoice && correctOption >= 0 ? undefined : problem.answerKey,
        options: multipleChoice ? problem.options : undefined,
        correctOption: multipleChoice && correctOption >= 0 ? correctOption + 1 : undefined,
        acceptedAnswers: problem.acceptedAnswers,
        caseSensitive: problem.caseSensitive,
        topicTags: problem.topicTags,
        points: problem.points,
        solution: problem.explanationNote,
      };
    }),
  };
}
