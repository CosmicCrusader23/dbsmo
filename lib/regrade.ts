import type { AnswerType } from "./grading";
import { gradeAnswer } from "./grading";

type RegradeProblem = {
  id: string;
  answerType: string;
  answerKey: string;
  acceptedAnswers: string[];
  caseSensitive: boolean;
  points: number;
};

type RegradeResponse = {
  id: string;
  problemId: string;
  rawAnswer: string;
  normalizedAnswer: string;
  isCorrect: boolean;
  pointsAwarded: number;
};

export type RegradedResponse = {
  id: string;
  isCorrect: boolean;
  normalizedAnswer: string;
  pointsAwarded: number;
};

export function calculateRegrade(
  problemsById: ReadonlyMap<string, RegradeProblem>,
  responses: readonly RegradeResponse[],
) {
  let score = 0;
  let maxScore = 0;
  const changedResponses: RegradedResponse[] = [];

  for (const response of responses) {
    const problem = problemsById.get(response.problemId);
    if (!problem) continue;

    const graded = gradeAnswer({
      answerType: problem.answerType.toLowerCase() as AnswerType,
      answerKey: problem.answerKey,
      rawAnswer: response.rawAnswer,
      acceptedAnswers: problem.acceptedAnswers,
      caseSensitive: problem.caseSensitive,
    });
    const pointsAwarded = graded.isCorrect ? problem.points : 0;
    score += pointsAwarded;
    maxScore += problem.points;

    if (
      response.isCorrect !== graded.isCorrect ||
      response.pointsAwarded !== pointsAwarded ||
      response.normalizedAnswer !== graded.normalizedAnswer
    ) {
      changedResponses.push({
        id: response.id,
        isCorrect: graded.isCorrect,
        normalizedAnswer: graded.normalizedAnswer,
        pointsAwarded,
      });
    }
  }

  return { changedResponses, score, maxScore };
}
