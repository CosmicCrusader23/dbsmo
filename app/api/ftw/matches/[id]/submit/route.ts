import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { authOptions } from "@/lib/auth";
import { type AnswerType, gradeAnswer } from "@/lib/grading";
import { FTW_PROBLEM_LIMIT_SEC, scoreFromElapsed } from "@/lib/ftw";

export const runtime = "nodejs";

const submitSchema = z.object({
  problemIndex: z.number().int().nonnegative(),
  answer: z.string(),
});

const ANSWER_TYPE_MAP = {
  EXACT: "exact",
  INTEGER: "integer",
  DECIMAL: "decimal",
  FRACTION: "fraction",
  SET: "set",
  MULTIPLE: "multiple",
  EXPRESSION: "expression",
} as const satisfies Record<string, AnswerType>;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const parsed = submitSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 422 });
  }

  const { id } = await params;
  const match = await prisma.ftwMatch.findUnique({ where: { id } });
  if (!match || match.userId !== session.user.id) {
    return NextResponse.json({ error: "Match not found." }, { status: 404 });
  }
  if (match.status !== "IN_PROGRESS") {
    return NextResponse.json({ error: "Match already finished." }, { status: 409 });
  }

  const answer = await prisma.ftwAnswer.findUnique({
    where: { matchId_problemIndex: { matchId: match.id, problemIndex: parsed.data.problemIndex } },
    include: { problem: true },
  });

  if (!answer) {
    return NextResponse.json({ error: "Problem not served." }, { status: 404 });
  }
  if (answer.submittedAt) {
    return NextResponse.json({ error: "Already submitted." }, { status: 409 });
  }

  const now = Date.now();
  const elapsedMs = now - answer.servedAt.getTime();
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

  await prisma.$transaction([
    prisma.ftwAnswer.update({
      where: { id: answer.id },
      data: {
        submittedAt: new Date(now),
        rawAnswer: parsed.data.answer,
        isCorrect: timedOut ? false : isCorrect,
        elapsedMs,
        points,
      },
    }),
    prisma.ftwMatch.update({
      where: { id: match.id },
      data: { totalScore: { increment: points } },
    }),
  ]);

  const refreshed = await prisma.ftwMatch.findUnique({ where: { id: match.id } });
  const isLast = (refreshed?.problemsServed ?? 0) >= (refreshed?.totalProblems ?? 0);
  let finalStatus = refreshed?.status ?? "IN_PROGRESS";
  if (isLast && refreshed?.status === "IN_PROGRESS") {
    await prisma.ftwMatch.update({
      where: { id: match.id },
      data: { status: "COMPLETED", completedAt: new Date() },
    });
    finalStatus = "COMPLETED";
  }

  return NextResponse.json({
    isCorrect: timedOut ? false : isCorrect,
    points,
    elapsedMs,
    timedOut,
    totalScore: refreshed?.totalScore ?? match.totalScore,
    matchStatus: finalStatus,
  });
}
