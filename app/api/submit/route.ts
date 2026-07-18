import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { gradeAnswer } from "@/lib/grading";
import type { AnswerType } from "@/lib/grading";
import { authOptions } from "@/lib/auth";
import { isVisibleToStudent } from "@/lib/visibility";
import { readJsonBody } from "@/lib/http-body";
import { isRetryablePrismaTransactionError } from "@/lib/prisma-errors";
import { MAX_SUBMISSION_BODY_BYTES, problemSetSubmissionSchema } from "@/lib/submission";

export const runtime = "nodejs";

const MAX_TRANSACTION_ATTEMPTS = 3;

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = await readJsonBody(request, { maxBytes: MAX_SUBMISSION_BODY_BYTES });
  if (!body.ok) {
    if (body.reason === "too_large") {
      return NextResponse.json({ error: "Submission payload is too large." }, { status: 413 });
    }
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const parsed = problemSetSubmissionSchema.safeParse(body.value);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed.", details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  const { problemSetId, answers, durationSeconds } = parsed.data;

  /* ── Load problem set and problems ─────────────────── */
  const [problemSet, user] = await Promise.all([
    prisma.problemSet.findUnique({
      where: { id: problemSetId },
      include: { problems: { orderBy: { number: "asc" } } },
    }),
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, role: true },
    }),
  ]);

  if (!problemSet) {
    return NextResponse.json({ error: "Problem set not found." }, { status: 404 });
  }

  if (!user) {
    return NextResponse.json({ error: "User record not found." }, { status: 401 });
  }

  if (user.role !== "ADMIN" && !isVisibleToStudent(problemSet)) {
    return NextResponse.json(
      { error: "This set is not available to your account." },
      { status: 403 },
    );
  }

  /* ── Grade each problem ────────────────────────────── */
  const results = problemSet.problems.map((problem) => {
    const rawAnswer = answers[String(problem.number)] ?? "";
    const graded = gradeAnswer({
      answerType: problem.answerType.toLowerCase() as AnswerType,
      answerKey: problem.answerKey,
      rawAnswer,
      acceptedAnswers: problem.acceptedAnswers,
      caseSensitive: problem.caseSensitive,
    });

    return {
      problemId: problem.id,
      problemNumber: problem.number,
      rawAnswer,
      normalizedAnswer: graded.normalizedAnswer,
      isCorrect: graded.isCorrect,
      pointsAwarded: graded.isCorrect ? problem.points : 0,
      maxPoints: problem.points,
    };
  });

  const score = results.reduce((sum, r) => sum + r.pointsAwarded, 0);
  const maxScore = results.reduce((sum, r) => sum + r.maxPoints, 0);

  /* ── Persist attempt + responses in a serializable transaction ── */
  type PersistedSubmission =
    | { kind: "locked"; attemptNumber: number }
    | { kind: "created"; attemptId: string; attemptNumber: number };

  let persisted: PersistedSubmission | null = null;
  for (
    let transactionAttempt = 1;
    transactionAttempt <= MAX_TRANSACTION_ATTEMPTS;
    transactionAttempt++
  ) {
    try {
      persisted = await prisma.$transaction(
        async (tx): Promise<PersistedSubmission> => {
          const perfectAttempts = await tx.$queryRaw<Array<{ attemptNumber: number }>>`
            SELECT "attemptNumber"
            FROM "Attempt"
            WHERE "userId" = ${user.id}
              AND "problemSetId" = ${problemSetId}
              AND "maxScore" > 0
              AND "score" = "maxScore"
            ORDER BY "attemptNumber" ASC
            LIMIT 1
          `;
          if (perfectAttempts[0]) {
            return { kind: "locked", attemptNumber: perfectAttempts[0].attemptNumber };
          }

          const maxima = await tx.$queryRaw<Array<{ maxAttemptNumber: number | null }>>`
            SELECT MAX("attemptNumber") AS "maxAttemptNumber"
            FROM "Attempt"
            WHERE "userId" = ${user.id}
              AND "problemSetId" = ${problemSetId}
          `;
          const attemptNumber = (maxima[0]?.maxAttemptNumber ?? 0) + 1;
          const created = await tx.attempt.create({
            data: {
              userId: user.id,
              problemSetId,
              attemptNumber,
              score,
              maxScore,
              durationSeconds: durationSeconds ?? null,
            },
          });

          await tx.response.createMany({
            data: results.map((result) => ({
              attemptId: created.id,
              problemId: result.problemId,
              rawAnswer: result.rawAnswer,
              normalizedAnswer: result.normalizedAnswer,
              isCorrect: result.isCorrect,
              pointsAwarded: result.pointsAwarded,
            })),
          });

          return { kind: "created", attemptId: created.id, attemptNumber };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
      break;
    } catch (error) {
      if (
        isRetryablePrismaTransactionError(error) &&
        transactionAttempt < MAX_TRANSACTION_ATTEMPTS
      ) {
        continue;
      }
      if (isRetryablePrismaTransactionError(error)) {
        return NextResponse.json(
          { error: "Another submission completed at the same time. Please retry." },
          { status: 409 },
        );
      }
      console.error("Failed to persist submission:", error);
      return NextResponse.json({ error: "Could not save this submission." }, { status: 500 });
    }
  }

  if (!persisted) {
    return NextResponse.json({ error: "Could not save this submission." }, { status: 500 });
  }
  if (persisted.kind === "locked") {
    return NextResponse.json(
      {
        error: "You already solved this set with a perfect score, so it is locked.",
        locked: true,
        attemptNumber: persisted.attemptNumber,
      },
      { status: 409 },
    );
  }

  return NextResponse.json({
    ok: true,
    attemptId: persisted.attemptId,
    attemptNumber: persisted.attemptNumber,
    score,
    maxScore,
    percentage: maxScore > 0 ? Math.round((score / maxScore) * 100) : 0,
    results: results.map((r) => ({
      number: r.problemNumber,
      rawAnswer: r.rawAnswer,
      isCorrect: r.isCorrect,
      pointsAwarded: r.pointsAwarded,
    })),
  });
}
