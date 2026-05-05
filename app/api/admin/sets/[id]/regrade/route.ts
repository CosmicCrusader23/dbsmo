import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { prisma } from "@/lib/db";
import { gradeAnswer, AnswerType } from "@/lib/grading";
import { authOptions } from "@/lib/auth";
import { recordAuditLog } from "@/lib/audit";
import { hasPermission } from "@/lib/permissions";

export const runtime = "nodejs";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: problemSetId } = await params;
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || !hasPermission(session.user.role, "admin:content")) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const set = await prisma.problemSet.findUnique({
      where: { id: problemSetId },
      include: { problems: true },
    });

    if (!set) {
      return NextResponse.json({ error: "Set not found." }, { status: 404 });
    }

    const attempts = await prisma.attempt.findMany({
      where: { problemSetId },
      include: { responses: true },
    });

    let updatedAttempts = 0;

    await prisma.$transaction(async (tx) => {
      for (const attempt of attempts) {
        let newScore = 0;
        let newMaxScore = 0;

        for (const response of attempt.responses) {
          const problem = set.problems.find((p) => p.id === response.problemId);
          if (!problem) continue;

          const graded = gradeAnswer({
            answerType: problem.answerType.toLowerCase() as AnswerType,
            answerKey: problem.answerKey,
            rawAnswer: response.rawAnswer,
            acceptedAnswers: problem.acceptedAnswers,
            caseSensitive: problem.caseSensitive,
          });

          const newPointsAwarded = graded.isCorrect ? problem.points : 0;
          newScore += newPointsAwarded;
          newMaxScore += problem.points;

          if (
            response.isCorrect !== graded.isCorrect ||
            response.pointsAwarded !== newPointsAwarded ||
            response.normalizedAnswer !== graded.normalizedAnswer
          ) {
            await tx.response.update({
              where: { id: response.id },
              data: {
                isCorrect: graded.isCorrect,
                pointsAwarded: newPointsAwarded,
                normalizedAnswer: graded.normalizedAnswer,
              },
            });
          }
        }

        if (attempt.score !== newScore || attempt.maxScore !== newMaxScore) {
          await tx.attempt.update({
            where: { id: attempt.id },
            data: { score: newScore, maxScore: newMaxScore },
          });
          updatedAttempts++;
        }
      }
    });

    await recordAuditLog({
      actorId: session.user.id,
      action: "problem_set.regrade",
      targetType: "ProblemSet",
      targetId: problemSetId,
      metadata: { updatedAttempts, totalAttempts: attempts.length },
    });

    return NextResponse.json({ ok: true, updatedAttempts, totalAttempts: attempts.length });
  } catch (error) {
    console.error("Regrade failed:", error);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
