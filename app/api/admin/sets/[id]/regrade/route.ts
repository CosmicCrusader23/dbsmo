import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { authOptions } from "@/lib/auth";
import { recordAuditLog } from "@/lib/audit";
import { hasPermission } from "@/lib/permissions";
import { calculateRegrade } from "@/lib/regrade";

export const runtime = "nodejs";
const REGRADE_PAGE_SIZE = 50;

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

    let updatedAttempts = 0;
    let totalAttempts = 0;
    let cursor: string | undefined;
    const regradedAt = new Date();
    const problemsById = new Map(set.problems.map((problem) => [problem.id, problem]));

    while (true) {
      const attempts = await prisma.attempt.findMany({
        where: { problemSetId },
        include: { responses: true },
        orderBy: { id: "asc" },
        take: REGRADE_PAGE_SIZE,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      });
      if (attempts.length === 0) break;

      for (const attempt of attempts) {
        const result = calculateRegrade(problemsById, attempt.responses);
        const updates: Prisma.PrismaPromise<unknown>[] = result.changedResponses.map((response) =>
          prisma.response.update({
            where: { id: response.id },
            data: {
              isCorrect: response.isCorrect,
              pointsAwarded: response.pointsAwarded,
              normalizedAnswer: response.normalizedAnswer,
            },
          }),
        );
        updates.push(
          prisma.attempt.update({
            where: { id: attempt.id },
            data: { score: result.score, maxScore: result.maxScore, gradedAt: regradedAt },
          }),
        );
        await prisma.$transaction(updates);

        if (attempt.score !== result.score || attempt.maxScore !== result.maxScore) {
          updatedAttempts++;
        }
        totalAttempts++;
      }

      cursor = attempts.at(-1)?.id;
      if (attempts.length < REGRADE_PAGE_SIZE) break;
    }

    await recordAuditLog({
      actorId: session.user.id,
      action: "problem_set.regrade",
      targetType: "ProblemSet",
      targetId: problemSetId,
      metadata: { updatedAttempts, totalAttempts },
    });

    return NextResponse.json({ ok: true, updatedAttempts, totalAttempts });
  } catch (error) {
    console.error("Regrade failed:", error);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
