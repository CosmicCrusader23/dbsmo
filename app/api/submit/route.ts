import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { gradeAnswer } from "@/lib/grading";
import type { AnswerType } from "@/lib/grading";
import { authOptions } from "@/lib/auth";
import { getUserGroups } from "@/lib/auth-server";
import { isVisibleToStudent } from "@/lib/visibility";

export const runtime = "nodejs";

const submitSchema = z.object({
  problemSetId: z.string().min(1),
  answers: z.record(z.string(), z.string()),
  durationSeconds: z.number().int().nonnegative().optional(),
});

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
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
    return NextResponse.json(
      { error: "Validation failed.", details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  const { problemSetId, answers, durationSeconds } = parsed.data;

  /* ── Load problem set and problems ─────────────────── */
  const problemSet = await prisma.problemSet.findUnique({
    where: { id: problemSetId },
    include: { problems: { orderBy: { number: "asc" } } },
  });

  if (!problemSet) {
    return NextResponse.json({ error: "Problem set not found." }, { status: 404 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, role: true, group: true },
  });

  if (!user) {
    return NextResponse.json({ error: "User record not found." }, { status: 401 });
  }

  if (user.role !== "ADMIN" && !isVisibleToStudent(problemSet, getUserGroups(user))) {
    return NextResponse.json(
      { error: "This set is not available to your account." },
      { status: 403 },
    );
  }

  /* ── Determine attempt number ──────────────────────── */
  const previousAttempts = await prisma.attempt.count({
    where: { userId: user.id, problemSetId },
  });
  const attemptNumber = previousAttempts + 1;

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

  /* ── Persist attempt + responses in transaction ────── */
  const attempt = await prisma.$transaction(async (tx) => {
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
      data: results.map((r) => ({
        attemptId: created.id,
        problemId: r.problemId,
        rawAnswer: r.rawAnswer,
        normalizedAnswer: r.normalizedAnswer,
        isCorrect: r.isCorrect,
        pointsAwarded: r.pointsAwarded,
      })),
    });

    return created;
  });

  return NextResponse.json({
    ok: true,
    attemptId: attempt.id,
    attemptNumber,
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
