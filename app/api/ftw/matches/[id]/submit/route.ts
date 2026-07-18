import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { authOptions } from "@/lib/auth";
import { type AnswerType, gradeAnswer } from "@/lib/grading";
import { FTW_PROBLEM_LIMIT_SEC, scoreFromElapsed } from "@/lib/ftw";
import { lockFtwMatch } from "@/lib/ftw-locks";
import { readJsonBody } from "@/lib/http-body";

export const runtime = "nodejs";

const submitSchema = z.object({
  problemIndex: z.number().int().nonnegative().max(1_000),
  answer: z.string().max(4_000),
});
const MAX_FTW_REQUEST_BYTES = 16_000;

const ANSWER_TYPE_MAP = {
  EXACT: "exact",
  INTEGER: "integer",
  DECIMAL: "decimal",
  FRACTION: "fraction",
  SET: "set",
  MULTIPLE: "multiple",
  EXPRESSION: "expression",
} as const satisfies Record<string, AnswerType>;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = await readJsonBody(request, { maxBytes: MAX_FTW_REQUEST_BYTES });
  if (!body.ok) {
    if (body.reason === "too_large") {
      return NextResponse.json({ error: "Request is too large." }, { status: 413 });
    }
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const parsed = submitSchema.safeParse(body.value);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 422 });
  }

  const { id } = await params;
  const userId = session.user.id;
  const outcome = await prisma.$transaction(async (tx) => {
    if (!(await lockFtwMatch(tx, id, userId))) return { kind: "match-not-found" } as const;

    const match = await tx.ftwMatch.findUnique({ where: { id } });
    if (!match || match.userId !== userId) return { kind: "match-not-found" } as const;
    if (match.status !== "IN_PROGRESS") return { kind: "match-finished" } as const;

    const answer = await tx.ftwAnswer.findUnique({
      where: {
        matchId_problemIndex: {
          matchId: match.id,
          problemIndex: parsed.data.problemIndex,
        },
      },
      include: { problem: true },
    });
    if (!answer) return { kind: "problem-not-served" } as const;
    if (answer.submittedAt) return { kind: "already-submitted" } as const;

    const submittedAt = new Date();
    const elapsedMs = submittedAt.getTime() - answer.servedAt.getTime();
    const timedOut = elapsedMs >= FTW_PROBLEM_LIMIT_SEC * 1000;
    const { isCorrect } = timedOut
      ? { isCorrect: false }
      : gradeAnswer({
          rawAnswer: parsed.data.answer,
          answerType: ANSWER_TYPE_MAP[answer.problem.answerType],
          answerKey: answer.problem.answerKey,
          acceptedAnswers: answer.problem.acceptedAnswers,
          caseSensitive: answer.problem.caseSensitive,
        });
    const points = timedOut ? 0 : scoreFromElapsed(elapsedMs, isCorrect);

    const claim = await tx.ftwAnswer.updateMany({
      where: { id: answer.id, submittedAt: null },
      data: {
        submittedAt,
        rawAnswer: parsed.data.answer,
        isCorrect: timedOut ? false : isCorrect,
        elapsedMs,
        points,
      },
    });
    if (claim.count !== 1) return { kind: "already-submitted" } as const;

    // The conditional answer claim and score increment are committed together.
    // A retry that loses the claim cannot increment the match score.
    let updatedMatch = await tx.ftwMatch.update({
      where: { id: match.id },
      data: { totalScore: { increment: points } },
    });
    if (
      updatedMatch.problemsServed >= updatedMatch.totalProblems &&
      updatedMatch.status === "IN_PROGRESS"
    ) {
      updatedMatch = await tx.ftwMatch.update({
        where: { id: match.id },
        data: { status: "COMPLETED", completedAt: submittedAt },
      });
    }

    return {
      kind: "submitted",
      payload: {
        isCorrect: timedOut ? false : isCorrect,
        points,
        elapsedMs,
        timedOut,
        totalScore: updatedMatch.totalScore,
        matchStatus: updatedMatch.status,
      },
    } as const;
  });

  if (outcome.kind === "match-not-found") {
    return NextResponse.json({ error: "Match not found." }, { status: 404 });
  }
  if (outcome.kind === "match-finished") {
    return NextResponse.json({ error: "Match already finished." }, { status: 409 });
  }
  if (outcome.kind === "problem-not-served") {
    return NextResponse.json({ error: "Problem not served." }, { status: 404 });
  }
  if (outcome.kind === "already-submitted") {
    return NextResponse.json({ error: "Already submitted." }, { status: 409 });
  }

  return NextResponse.json(outcome.payload);
}
